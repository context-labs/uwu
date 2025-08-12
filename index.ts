import OpenAI from 'openai';
import { $ } from "bun";
import os from "os";

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Error: No command description provided.");
  console.error("Usage: ./bin <command description>");
  process.exit(1);
}

// Join all arguments to handle multi-word descriptions with proper spacing
const commandDescription = args.join(' ').trim();

if (!commandDescription) {
  console.error("Error: Command description cannot be empty.");
  process.exit(1);
}

// Build the environment context
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

// Get `ls -l` output (handle potential errors)
let lsResult = "";
try {
  lsResult = await $`ls`.text();
} catch (error) {
  console.error("Error getting directory listing:", error);
  // If ls fails, provide fallback information
  lsResult = "Unable to get directory listing";
}

// System prompt
const systemPrompt = `
You live in a developer's CLI, helping them convert natural language into CLI commands. 
Based on the description of the command given, generate the command. Output only the command and nothing else. 
Make sure to escape characters when appropriate. The result of \`ls -l\` is given with the command. 
This may be helpful depending on the description given. Do not include any other text in your response, except for the command.
Do not wrap the command in quotes.

--- ENVIRONMENT CONTEXT ---
${envContext}
--- END ENVIRONMENT CONTEXT ---

Result of \`ls -l\` in working directory:
${lsResult}
`;

// User prompt
const userPrompt = (commandDescription: string) => `
Command description:
${commandDescription}
`;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.chat.completions.create({
  model: "gpt-4.1",
  messages: [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userPrompt(commandDescription),
    },
  ],
});

const command = response?.choices[0]?.message?.content?.trim();

if (command) {
  console.log(`\nSuggested command:\n  \x1b[32m${command}\x1b[0m\n`);
  process.stdout.write("Execute this command? (y/n) ");

  for await (const line of console) {
    const answer = line.trim().toLowerCase();
    if (answer === 'y' || answer === 'yes') {
      try {
        await $`${{ raw: command }}`;
      } catch (error) {
        console.error("Error executing command:", error);
      }
    } else {
      console.log("Command execution aborted.");
    }
    process.exit(0);
  }
} else {
    console.error("Could not generate a command.");
    process.exit(1);
}