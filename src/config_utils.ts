import fs from "fs";
import path from "path";
import envPaths, { type Paths } from "env-paths";
import type { Config } from "./types";
import { DEFAULT_CONTEXT_CONFIG } from "../context";

const DEFAULT_CONFIG: Config = {
  type: "OpenAI",
  model: "gpt-4.1",
  context: DEFAULT_CONTEXT_CONFIG,
};

const createConfigFile = (paths: Paths, configPath: string) => {
  try {
    fs.mkdirSync(paths.config, { recursive: true });
    const defaultConfigToFile = {
      ...DEFAULT_CONFIG,
      apiKey: "",
      baseURL: null,
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfigToFile, null, 2));
  } catch (error) {
    console.error("Error creating the configuration file at:", configPath);
    console.error("Please check your permissions for the directory.");
    process.exit(1);
  }
};

export function getConfig(): Config {
  const paths = envPaths("uwu", { suffix: "" });
  const configPath = path.join(paths.config, "config.json");

  const doesConfigFileExist = fs.existsSync(configPath);
  if (!doesConfigFileExist) {
    createConfigFile(paths, configPath);

    // For this first run, use the environment variable for the API key.
    // The newly created file has an empty key, so subsequent runs will also fall back to the env var until the user edits the file.
    return {
      ...DEFAULT_CONFIG,
      apiKey: process.env.OPENAI_API_KEY,
    };
  }

  try {
    const rawConfig = fs.readFileSync(configPath, "utf-8");
    const userConfig = JSON.parse(rawConfig);

    // Merge user config with defaults, and also check env for API key as a fallback.
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
