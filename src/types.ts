export interface ContextConfig {
  enabled?: boolean;
  maxHistoryCommands?: number;
}

export type ProviderType = "OpenAI" | "Custom" | "Claude" | "Gemini" | "GitHub";

export interface Config {
  type: ProviderType;
  apiKey?: string;
  model: string;
  baseURL?: string;
  context?: ContextConfig;
}
