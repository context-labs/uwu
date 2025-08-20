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

export const createConfigFile = (paths: Paths, configPath: string) => {
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

export const readJson = (path: string) => {
  const fileContent = fs.readFileSync(path, "utf-8");
  return JSON.parse(fileContent);
};

export function getConfig(): Config {
  const paths = envPaths("uwu", { suffix: "" });
  const configPath = path.join(paths.config, "config.json");

  const doesConfigFileExist = fs.existsSync(configPath);
  if (!doesConfigFileExist) {
    createConfigFile(paths, configPath);

    return {
      ...DEFAULT_CONFIG,
      apiKey: process.env.OPENAI_API_KEY,
    };
  }

  try {
    const userConfig = readJson(configPath);

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
