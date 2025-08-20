import {
  afterEach,
  beforeEach,
  describe,
  expect,
  jest,
  mock,
  test,
} from "bun:test";

mock.module("../src/config_utils", () => ({
  readJson: mock(),
  createConfigFile: mock(),
}));

import { getConfig, readJson } from "../src/config_utils";
import type { Config } from "../src/types";
import { withMockedConsoleAndExit } from "./config_utils.test";

describe("getConfig", () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = "env-api-key";
    mock.module("../src/config_utils", () => ({
      readJson: mock(),
      createConfigFile: mock(),
    }));
  });

  afterEach(() => {
    mock.restore();
    delete process.env.OPENAI_API_KEY;
  });

  test("should return merged config when readJson provides user config", () => {
    (readJson as jest.Mock).mockReturnValue({
      apiKey: "123",
    });

    const config = getConfig();

    const expected: Config = {
      type: "OpenAI",
      model: "gpt-4.1",
      context: {
        enabled: false,
        maxHistoryCommands: 10,
      },
      apiKey: "123",
    };

    expect(config).toEqual(expected);
  });

  test("should fall back to env API key when readJson has no apiKey", () => {
    (readJson as jest.Mock).mockReturnValue({
      type: "Gemini",
    });

    const config = getConfig();

    expect(config.apiKey).toBe("env-api-key");
    expect(config.type).toBe("Gemini");
  });

  test("should create config file if readJson throws (no config file exists)", () => {
    (readJson as jest.Mock).mockImplementation(() => {
      throw new Error("file not found");
    });

    const { processExitMock, consoleErrorMock } = withMockedConsoleAndExit(() =>
      expect(() => getConfig()).toThrow("EXIT")
    );

    expect(processExitMock).toBeCalledWith(1);
    expect(consoleErrorMock).toBeCalledTimes(2);
  });
});
