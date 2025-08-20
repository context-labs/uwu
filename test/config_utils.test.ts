import {
  describe,
  test,
  expect,
  mock,
  beforeEach,
  afterEach,
  jest,
} from "bun:test";
import fs from "fs";
import { createConfigFile, readJson } from "../src/config_utils";
import type { Paths } from "env-paths";

const mockMkdir = mock(() => {});
const mockWriteFile = mock(() => {});
const mockReadFile = mock(() => {});

export function withMockedConsoleAndExit(fn: () => void) {
  const originalConsoleError = console.error;
  const originalExit = process.exit;

  const consoleErrorMock = mock(() => {});
  const processExitMock = mock(() => {
    throw "EXIT";
  });

  console.error = consoleErrorMock as any;
  process.exit = processExitMock;

  try {
    fn();
  } finally {
    console.error = originalConsoleError;
    process.exit = originalExit;
  }

  return { consoleErrorMock, processExitMock };
}

describe("createConfigFile", () => {
  const mockPaths: Paths = {
    config: "/mock/config",
    cache: "/mock/cache",
    data: "/mock/data",
    log: "/mock/log",
    temp: "/mock/temp",
  };
  const mockConfigPath = "/mock/config/config.json";

  const expectedConfig = {
    type: "OpenAI",
    model: "gpt-4.1",
    context: {
      enabled: false,
      maxHistoryCommands: 10,
    },
    apiKey: "",
    baseURL: null,
  };

  beforeEach(() => {
    mockMkdir.mockReset();
    mockWriteFile.mockReset();

    fs.mkdirSync = mockMkdir as any;
    fs.writeFileSync = mockWriteFile as any;
  });

  afterEach(() => {
    mock.restore();
  });

  test("should creates config directory and writes default config file", () => {
    createConfigFile(mockPaths, mockConfigPath);

    expect(mockMkdir).toHaveBeenCalledWith(mockPaths.config, {
      recursive: true,
    });

    expect(mockWriteFile).toHaveBeenCalledWith(
      mockConfigPath,
      JSON.stringify(expectedConfig, null, 2)
    );
  });

  test("should log error and exits if mkdirSync throws", () => {
    mockMkdir.mockImplementation(() => {
      throw new Error("mkdir failed");
    });

    const { consoleErrorMock, processExitMock } = withMockedConsoleAndExit(
      () => {
        expect(() => createConfigFile(mockPaths, mockConfigPath)).toThrow(
          "EXIT"
        );
      }
    );

    expect(consoleErrorMock).toHaveBeenCalledWith(
      "Error creating the configuration file at:",
      mockConfigPath
    );
    expect(consoleErrorMock).toHaveBeenCalledWith(
      "Please check your permissions for the directory."
    );
    expect(processExitMock).toHaveBeenCalledWith(1);
  });

  test("should log error and exits if writeFileSync throws", () => {
    mockWriteFile.mockImplementation(() => {
      throw new Error("write failed");
    });

    const { consoleErrorMock, processExitMock } = withMockedConsoleAndExit(
      () => {
        expect(() => createConfigFile(mockPaths, mockConfigPath)).toThrow(
          "EXIT"
        );
      }
    );

    expect(consoleErrorMock).toHaveBeenCalledWith(
      "Error creating the configuration file at:",
      mockConfigPath
    );
    expect(consoleErrorMock).toHaveBeenCalledWith(
      "Please check your permissions for the directory."
    );
    expect(processExitMock).toHaveBeenCalledWith(1);
  });
});

describe("readJson", () => {
  const mockPath = "/mock/config.json";

  beforeEach(() => {
    mockReadFile.mockReset();
    fs.readFileSync = mockReadFile as any;
  });

  afterEach(() => {
    mock.restore();
  });

  test("should return parsed JSON when file contains valid JSON", () => {
    const expected = { foo: "bar", num: 42 };
    mockReadFile.mockImplementation(() => JSON.stringify(expected));

    const result = readJson(mockPath);

    expect(mockReadFile).toHaveBeenCalledWith(mockPath, "utf-8");
    expect(result).toEqual(expected);
  });

  test("should throw SyntaxError when file contains invalid JSON", () => {
    mockReadFile.mockImplementation(() => "{ invalid json }");

    expect(() => readJson(mockPath)).toThrow(SyntaxError);
  });

  test("should throw if fs.readFileSync fails", () => {
    mockReadFile.mockImplementation(() => {
      throw new Error("read failed");
    });

    expect(() => readJson(mockPath)).toThrow("read failed");
  });
});
