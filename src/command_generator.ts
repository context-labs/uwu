import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { $ } from "bun";
import os from "os";
import type { Config } from "./types";
import { buildContextHistory, DEFAULT_CONTEXT_CONFIG } from "../context";

const lastMatched = (regex: RegExp, content: string) => {
  let lastOne;
  let matched;
  while ((matched = regex.exec(content))) {
    lastOne = matched[1];
  }

  return lastOne;
};

const findLastCommand = (lines: string[]) => {
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]!;

    const looksLikeSentence =
      /^[A-Z][\s\S]*[.?!]$/.test(line) ||
      /\b(user|want|should|shouldn't|think|explain|error|note)\b/i.test(line);

    if (!looksLikeSentence && line.length <= 2000) {
      return line.trim();
    }
  }

  return lines.at(-1)!.trim();
};

function sanitizeResponse(content: string): string {
  if (!content) return "";

  let strippedContent = content.replace(
    /<\s*think\b[^>]*>[\s\S]*?<\s*\/\s*think\s*>/gi,
    ""
  );

  const codeBlockRegex = /```(?:[^\n]*)\n([\s\S]*?)```/g;

  strippedContent =
    lastMatched(codeBlockRegex, strippedContent) ||
    strippedContent.replace(/`/g, "");

  const lines = strippedContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  return lines.length !== 0 ? findLastCommand(lines) : "";
}

export async function generateCommand(
  config: Config,
  commandDescription: string
): Promise<string> {
  // Exiting as fast as possible
  if (!config.apiKey) {
    console.error("Error: API key not found.");
    console.error(
      "Please provide an API key in your config.json file or by setting the OPENAI_API_KEY environment variable."
    );
    process.exit(1);
  }

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

  // Get directory listing (`ls` on Unix, `dir` on Windows)
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

  // Build command history context if enabled
  const contextConfig = config.context || DEFAULT_CONTEXT_CONFIG;
  const historyContext = buildContextHistory(contextConfig);

  // System prompt
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
      const openai = new OpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
      const response = await openai.chat.completions.create({
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
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
      const anthropic = new Anthropic({ apiKey: config.apiKey });
      const response = await anthropic.messages.create({
        model: config.model,
        system: systemPrompt,
        max_tokens: 1024,
        messages: [
          {
            role: "user",
            content: `Command description: ${commandDescription}`,
          },
        ],
      });

      // @ts-ignore
      const raw = response.content?.[0]?.text ?? response?.text ?? "";

      return sanitizeResponse(String(raw));
    }

    case "Gemini": {
      const genAI = new GoogleGenerativeAI(config.apiKey);
      const model = genAI.getGenerativeModel({ model: config.model });
      const prompt = `${systemPrompt}\n\nCommand description: ${commandDescription}`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const raw = await response.text();

      return sanitizeResponse(String(raw));
    }

    case "GitHub": {
      const endpoint = config.baseURL
        ? config.baseURL
        : "https://models.github.ai/inference";
      const model = config.model ? config.model : "openai/gpt-4.1-nano";
      const github = ModelClient(
        endpoint,
        new AzureKeyCredential(config.apiKey)
      );

      const response = await github.path("/chat/completions").post({
        body: {
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Command description: ${commandDescription}`,
            },
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

    default:
      console.error(
        `Error: Unknown provider type "${config.type}" in config.json.`
      );
      process.exit(1);
  }
}
