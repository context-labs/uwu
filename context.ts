import fs from "fs";
import path from "path";
import os from "os";
import type { ContextConfig } from "./src/types";

export const DEFAULT_CONTEXT_CONFIG: ContextConfig = {
  enabled: false,
  maxHistoryCommands: 10,
};

// Size of each backwards-read chunk when scanning shell history files.
// Unit: bytes. 64 KiB balances I/O efficiency with memory usage.
const HISTORY_READ_CHUNK_SIZE_BYTES = 64 * 1024;

// Shell history parsing functions
function getHistoryFilePath(): string | null {
  const shell = process.env.SHELL || "";
  const home = os.homedir();
  const isWindows = process.platform === "win32";

  // Windows: Prefer PowerShell PSReadLine history if available
  if (isWindows) {
    const appData =
      process.env.APPDATA || path.join(home, "AppData", "Roaming");
    const psHistoryCandidates = [
      // Windows PowerShell 5.x
      path.join(
        appData,
        "Microsoft",
        "Windows",
        "PowerShell",
        "PSReadLine",
        "ConsoleHost_history.txt"
      ),
      // PowerShell 7+
      path.join(
        appData,
        "Microsoft",
        "PowerShell",
        "PSReadLine",
        "ConsoleHost_history.txt"
      ),
    ];
    for (const psPath of psHistoryCandidates) {
      if (fs.existsSync(psPath)) return psPath;
    }
    // If nothing found on Windows, fall through to shared fallbacks that may exist under Git Bash, MSYS, or Cygwin
  }

  if (shell.includes("zsh")) {
    return process.env.HISTFILE || path.join(home, ".zsh_history");
  } else if (shell.includes("bash")) {
    return process.env.HISTFILE || path.join(home, ".bash_history");
  } else if (shell.includes("fish")) {
    const macFish = path.join(
      home,
      "Library",
      "Application Support",
      "fish",
      "fish_history"
    );
    const linuxFish = path.join(
      home,
      ".local",
      "share",
      "fish",
      "fish_history"
    );
    if (fs.existsSync(macFish)) return macFish;
    return linuxFish;
  }

  // Try common paths as fallback
  const commonPaths = [
    path.join(home, ".zsh_history"),
    path.join(home, ".bash_history"),
    path.join(home, ".local", "share", "fish", "fish_history"),
    path.join(home, "Library", "Application Support", "fish", "fish_history"),
  ];

  for (const histPath of commonPaths) {
    if (fs.existsSync(histPath)) {
      return histPath;
    }
  }

  return null;
}

/**
 * Efficiently read the last N non-empty lines of a file without loading the whole file.
 *
 * Reads the file from the end in fixed-size chunks to avoid loading it entirely.
 * Chunk size is defined by `HISTORY_READ_CHUNK_SIZE_BYTES` (bytes).
 */
function readLastLines({
  filePath,
  maxLines,
}: {
  filePath: string;
  maxLines: number;
}): string[] {
  let fd: number | null = null;
  try {
    fd = fs.openSync(filePath, "r");
    const { size } = fs.fstatSync(fd);
    if (size === 0) return [];

    let position = size;
    let accumulator = "";
    const buffer = Buffer.allocUnsafe(
      Math.min(HISTORY_READ_CHUNK_SIZE_BYTES, size)
    );

    const hasEnoughLines = () =>
      (accumulator.match(/\n/g)?.length || 0) >= maxLines + 1;

    while (position > 0 && !hasEnoughLines()) {
      const readLength = Math.min(buffer.length, position);
      position -= readLength;
      fs.readSync(fd, buffer, 0, readLength, position);
      accumulator = buffer.toString("utf8", 0, readLength) + accumulator;
    }

    const allLines = accumulator.split("\n");
    const nonEmpty = allLines.filter((l) => l.trim());
    return nonEmpty.slice(-maxLines);
  } catch {
    return [];
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {}
    }
  }
}

function getRecentCommands(maxCommands: number): string[] {
  const historyPath = getHistoryFilePath();
  if (!historyPath) {
    return [];
  }

  try {
    // Include full raw lines from the history file for richer context
    return readLastLines({ filePath: historyPath, maxLines: maxCommands });
  } catch {
    return [];
  }
}

export function buildContextHistory(contextConfig: ContextConfig): string {
  if (!contextConfig.enabled) {
    return "";
  }

  let historyContext = "";

  // Get recent commands
  const recentCommands = getRecentCommands(
    contextConfig.maxHistoryCommands ||
      DEFAULT_CONTEXT_CONFIG.maxHistoryCommands!
  );
  if (recentCommands.length > 0) {
    historyContext += "\n--- RECENT COMMANDS ---\n";
    historyContext += "Recent shell commands (most recent last):\n";
    recentCommands.forEach((cmd, idx) => {
      historyContext += `${idx + 1}. ${cmd}\n`;
    });
    historyContext += "--- END COMMAND HISTORY ---\n";
  }

  return historyContext;
}
