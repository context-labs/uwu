import { describe, expect, test } from "bun:test";
import { findLastCommand, lastMatched } from "../src/command_generator";

describe("lastMatched", () => {
  test("should return the last captured group from multiple matches", () => {
    const regex = /<p>([\s\S]*?)<\/p>/g;
    const content =
      "<div><p>First paragraph.</p><p>Second paragraph.</p><p>Third paragraph.</p></div>";

    expect(lastMatched(regex, content)).toBe("Third paragraph.");
  });

  test("should return the captured group from a single match", () => {
    const regex = /```([\s\S]*?)```/g;
    const content = '```console.log("hello world")```';

    expect(lastMatched(regex, content)).toBe('console.log("hello world")');
  });

  test("should return undefined when no matches are found", () => {
    const regex = /<p>([\s\S]*?)<\/p>/g;
    const content = "<div><span>No paragraphs here</span></div>";

    expect(lastMatched(regex, content)).toBeUndefined();
  });

  test("should return undefined for an empty content string", () => {
    const regex = /test/g;

    expect(lastMatched(regex, "")).toBeUndefined();
  });
});

describe("findLastCommand", () => {
  test("should return the last non-sentence line", () => {
    const lines = [
      "This is a complete sentence.",
      "Here is another one.",
      "cd /home/user",
    ];

    expect(findLastCommand(lines)).toBe("cd /home/user");
  });

  test("should return the last non-sentence line even if it is not the very last line", () => {
    const lines = [
      "Some introductory text.",
      "npm install --save-dev",
      "The installation was successful.",
    ];

    expect(findLastCommand(lines)).toBe("npm install --save-dev");
  });

  test("should return the last line if all lines appear to be sentences", () => {
    const lines = [
      "This is a sentence.",
      "This is another sentence.",
      "And a final one with a period.",
    ];

    expect(findLastCommand(lines)).toBe("And a final one with a period.");
  });

  test("should return an empty string for an empty array", () => {
    const lines: string[] = [];

    expect(findLastCommand(lines)).toBe("");
  });

  test("should return the line itself if it is the only non-sentence line", () => {
    const lines = ["git push origin main"];

    expect(findLastCommand(lines)).toBe("git push origin main");
  });
});
