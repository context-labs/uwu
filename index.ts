import { generateCommand } from "./src/command_generator";
import { getConfig } from "./src/config_utils";

const config = getConfig();

// The rest of the arguments are the command description
const commandDescription = process.argv.slice(2).join(" ").trim();

if (!commandDescription) {
  console.error("Error: No command description provided.");
  console.error("Usage: uwu <command description>");
  process.exit(1);
}

// --- Main Execution ---
try {
  const command = await generateCommand(config, commandDescription);
  console.log(command);
} catch (error: any) {
  console.error("Error generating command:", error.message);
  process.exit(1);
}
