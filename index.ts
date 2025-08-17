import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import ModelClient, { isUnexpected } from '@azure-rest/ai-inference';
import { AzureKeyCredential } from '@azure/core-auth';
import { $ } from "bun";
import os from "os";
import fs from "fs";
import path from "path";
import envPaths from "env-paths";
import { DEFAULT_CONTEXT_CONFIG, buildContextHistory } from "./context";
import type { ContextConfig } from "./context";

// CONFLICT RESOLVED: Combined all provider types (GitHub from main + LlamaCpp from feature)
type ProviderType = "OpenAI" | "Custom" | "Claude" | "Gemini" | "GitHub" | "LlamaCpp";

interface Config {
  type: ProviderType;
  apiKey?: string;
  model: string;
  baseURL?: string;
  // CONFLICT RESOLVED: Combined both context config AND LlamaCpp options
  context?: ContextConfig;
  // LlamaCpp specific options
  modelPath?: string;
  contextSize?: number;
  temperature?: number;
  maxTokens?: number;
  threads?: number;
  port?: number;
}
// CONFLICT RESOLVED: Added Message interface from feature branch (needed for LlamaCpp)
interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}
const DEFAULT_CONFIG: Config = {
  type: "OpenAI",
  model: "gpt-4.1",
  context: DEFAULT_CONTEXT_CONFIG,
};

// Global server management
class LlamaCppServerManager {
  private static instance: LlamaCppServerManager;
  private serverProcess: any = null;
  private isRunning: boolean = false;
  private port: number = 8080;
  private config: Config | null = null;

  static getInstance(): LlamaCppServerManager {
    if (!LlamaCppServerManager.instance) {
      LlamaCppServerManager.instance = new LlamaCppServerManager();
    }
    return LlamaCppServerManager.instance;
  }

  private constructor() {
    process.on('SIGINT', () => this.shutdown());
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGUSR1', () => this.shutdown());
  }

  private getModelRepo(modelName: string): string {
    if (modelName.includes('/')) {
      return modelName;
    }
    
    const modelMappings: Record<string, string> = {
      'tinyllama-1.1b': 'TinyLlama/TinyLlama-1.1B-Chat-v1.0-GGUF',
      'smollm3-3b': 'ggml-org/SmolLM3-3B-GGUF',
      'gemma-3-4b': 'unsloth/gemma-3-4b-it-GGUF'
    };
    
    return modelMappings[modelName.toLowerCase()] || modelName;
  }

  async startServer(config: Config): Promise<void> {
    if (this.isRunning) return;

    this.config = config;
    this.port = config.port || 8080;

    const llamaDir = process.env.LLAMA_DIR;
    if (!llamaDir) {
      throw new Error("LLAMA_DIR environment variable not set");
    }

    const llamaServerPath = `${llamaDir}/build/bin/llama-server`;
    
    try {
      await $`${llamaServerPath} --version`.quiet();
    } catch {
      throw new Error(`llama-server not found at: ${llamaServerPath}`);
    }

    try {
      const response = await fetch(`http://localhost:${this.port}/health`);
      if (response.ok) {
        this.isRunning = true;
        return;
      }
    } catch {
      // Server not running, start it
    }

    const modelRepo = this.getModelRepo(config.model);
    const serverArgs = [
      '--hf-repo', modelRepo,
      '--port', this.port.toString(),
      '--ctx-size', (config.contextSize || 2048).toString(),
      '--threads', (config.threads || Math.max(1, os.cpus().length - 1)).toString(),
      '--log-disable'
    ];

    this.serverProcess = Bun.spawn([llamaServerPath, ...serverArgs], {
      stdout: 'ignore',
      stderr: 'ignore',
      detached: true,
    });

    // Detach the process so it can run independently
    this.serverProcess.unref();

    let retries = 30;
    while (retries > 0) {
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        const response = await fetch(`http://localhost:${this.port}/health`);
        if (response.ok) {
          this.isRunning = true;
          return;
        }
      } catch {
        retries--;
      }
    }
    
    throw new Error("Failed to start Llama.cpp server");
  }

  async generateCompletion(messages: Message[]): Promise<string> {
    if (!this.isRunning || !this.config) {
      throw new Error("Server not running");
    }

    try {
      const response = await fetch(`http://localhost:${this.port}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: messages,
          temperature: this.config.temperature || 0.1,
          max_tokens: this.config.maxTokens || 150,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error(`Server response: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      
      if (!content) {
        throw new Error("No content generated");
      }

      return content;
    } catch (error) {
      throw error;
    }
  }

  shutdown(): void {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
    this.isRunning = false;
    process.exit(0);
  }
}

function getConfig(): Config {
  const paths = envPaths("uwu", { suffix: "" });
  const configPath = path.join(paths.config, "config.json");

  if (!fs.existsSync(configPath)) {
    try {
      fs.mkdirSync(paths.config, { recursive: true });
      const defaultConfigToFile = {
        ...DEFAULT_CONFIG,
        apiKey: "",
        baseURL: null,
      };
      fs.writeFileSync(
        configPath,
        JSON.stringify(defaultConfigToFile, null, 2)
      );

      return {
        ...DEFAULT_CONFIG,
        apiKey: process.env.OPENAI_API_KEY,
      };
    } catch (error) {
      console.error("Error creating the configuration file at:", configPath);
      console.error("Please check your permissions for the directory.");
      process.exit(1);
    }
  }

  try {
    const rawConfig = fs.readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(rawConfig);

    // CONFLICT RESOLVED: Used main's improved merging logic with mergedConfig variable
    const mergedConfig = {
      ...DEFAULT_CONFIG,
      ...userConfig,
      apiKey: userConfig.apiKey || process.env.OPENAI_API_KEY,
    };

    // Ensure context config has all defaults filled in
    if (mergedConfig.context) {
      mergedConfig.context = {
        ...DEFAULT_CONTEXT_CONFIG,
        ...mergedConfig.context,
      };
    } else {
      mergedConfig.context = DEFAULT_CONTEXT_CONFIG;
    }

    return mergedConfig;
  } catch (error) {
    console.error(
      "Error reading or parsing the configuration file at:",
      configPath
    );
    console.error("Please ensure it is a valid JSON file.");
    process.exit(1);
  }
}

const config = getConfig();

// CONFLICT RESOLVED: Used main's version with double quotes and comment
const commandDescription = process.argv.slice(2).join(" ").trim();

if (!commandDescription) {
  console.error("Error: No command description provided.");
  console.error("Usage: uwu <command description>");
  process.exit(1);
}

// CONFLICT RESOLVED: Added main's sanitizeResponse function that was missing in feature branch
function sanitizeResponse(content: string): string {
  if (!content) return "";

  content = content.replace(
    /<\s*think\b[^>]*>[\s\S]*?<\s*\/\s*think\s*>/gi,
    ""
  );

  let lastCodeBlock: string | null = null;
  const codeBlockRegex = /```(?:[^\n]*)\n([\s\S]*?)```/g;
  let m;
  while ((m = codeBlockRegex.exec(content)) !== null) {
    lastCodeBlock = m[1];
  }
  if (lastCodeBlock) {
    content = lastCodeBlock;
  } else {
    content = content.replace(/`/g, "");
  }

  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return "";

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];

    const looksLikeSentence =
      /^[A-Z][\s\S]*[.?!]$/.test(line) ||
      /\b(user|want|should|shouldn't|think|explain|error|note)\b/i.test(line);
    if (!looksLikeSentence && line.length <= 2000) {
      return line.trim();
    }
  }

  return lines[lines.length - 1].trim();
}

// CONFLICT RESOLVED: Used main's function signature formatting
async function generateCommand(
  config: Config,
  commandDescription: string
): Promise<string> {
  const envContext = `
Operating System: ${os.type()} ${os.release()} (${os.platform()} - ${os.arch()})
Node.js Version: ${process.version}
Shell: ${process.env.SHELL || "unknown"}
Current Working Directory: ${process.cwd()}
Home Directory: ${os.homedir()}
CPU Info: ${os.cpus()[0]?.model} (${os.cpus().length} cores)
Total Memory: ${(os.totalmem() / 1024 / 1024).toFixed(0)} MB
Free Memory: ${(os.freemem() / 1024 / 1024).toFixed(0)} MB
`;

  // CONFLICT RESOLVED: Used main's cross-platform directory listing instead of just `ls -la`
  let lsResult = "";
  let lsCommand = "";
  try {
    if (process.platform === "win32") {
      // Use PowerShell-compatible dir for a simple listing
      lsCommand = "dir /b";
      lsResult = await $`cmd /c ${lsCommand}`.text();
    } else {
      lsCommand = "ls";
      lsResult = await $`${lsCommand}`.text();
    }
  } catch (error) {
    lsResult = "Unable to get directory listing";
  }

  // CONFLICT RESOLVED: Added main's context history feature
  const contextConfig = config.context || DEFAULT_CONTEXT_CONFIG;
  const historyContext = buildContextHistory(contextConfig);

  // CONFLICT RESOLVED: Used main's improved system prompt with better structure
  const systemPrompt = `
You live in a developer's CLI, helping them convert natural language into CLI commands. 
Based on the description of the command given, generate the command. Output only the command and nothing else. 
Make sure to escape characters when appropriate. The result of \`${lsCommand}\` is given with the command. 
This may be helpful depending on the description given. Do not include any other text in your response, except for the command.
Do not wrap the command in quotes.

--- ENVIRONMENT CONTEXT ---
${envContext}
--- END ENVIRONMENT CONTEXT ---

Result of \`${lsCommand}\` in working directory:
${lsResult}
${historyContext}`;

  switch (config.type) {
    case "OpenAI":
    case "Custom": {
      if (!config.apiKey) {
        console.error("Error: API key not found.");
        console.error("Please provide an API key in your config.json file or by setting the OPENAI_API_KEY environment variable.");
        process.exit(1);
      }

      const openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          // CONFLICT RESOLVED: Used main's format with "Command description:" prefix
          {
            role: "user",
            content: `Command description: ${commandDescription}`,
          },
        ],
      });
      const raw = response?.choices?.[0]?.message?.content ?? "";
      return sanitizeResponse(String(raw));
    }

    case "Claude": {
      if (!config.apiKey) {
        console.error("Error: API key not found.");
        console.error("Please provide an API key in your config.json file.");
        process.exit(1);
      }

      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response = await anthropic.messages.create({
        model: config.model,
        system: systemPrompt,
        max_tokens: 1024,
        messages: [
          // CONFLICT RESOLVED: Used main's format with "Command description:" prefix
          {
            role: "user",
            content: `Command description: ${commandDescription}`,
          },
        ],
      });
      // @ts-ignore
      const raw =
        response.content && response.content[0]
          ? response.content[0].text
          : response?.text ?? "";
      return sanitizeResponse(String(raw));
    }

    case "Gemini": {
      if (!config.apiKey) {
        console.error("Error: API key not found.");
        console.error("Please provide an API key in your config.json file.");
        process.exit(1);
      }

      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({ model: config.model });
      const prompt = `${systemPrompt}\n\nCommand description: ${commandDescription}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const raw = await response.text();
      return sanitizeResponse(String(raw));
    }

    case "GitHub": {
      const endpoint = config.baseURL ? config.baseURL : "https://models.github.ai/inference";
      const model = config.model ? config.model : "openai/gpt-4.1-nano";
      const github = ModelClient(
        endpoint,
        new AzureKeyCredential(config.apiKey)
      );

      const response = await github.path("/chat/completions").post({
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Command description: ${commandDescription}` },
          ],
          temperature: 1.0,
          top_p: 1.0,
          model: model,
        },
      });

      if (isUnexpected(response)) {
        throw response.body.error;
      }

      const content = response.body.choices?.[0]?.message?.content;
      return content?.trim() || "";
    }

    // CONFLICT RESOLVED: Added LlamaCpp provider from feature branch with proper sanitization
    case "LlamaCpp": {
      const serverManager = LlamaCppServerManager.getInstance();
      await serverManager.startServer(config);
      
      const messages: Message[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Command description: ${commandDescription}` }
      ];
      
      const raw = await serverManager.generateCompletion(messages);
      return sanitizeResponse(String(raw));
    }

    default:
      console.error(
        `Error: Unknown provider type "${config.type}" in config.json.`
      );
      process.exit(1);
  }
}

// Main Execution
try {
  const command = await generateCommand(config, commandDescription);
  
  if (!command) {
    console.error("Error: No command generated");
    process.exit(1);
  }

  const cleanCommand = command
    .replace(/^```.*?\n|```$/g, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .trim();
  
  console.log(cleanCommand);
  
} catch (error: any) {
  console.error("Error generating command:", error.message);
  process.exit(1);
}