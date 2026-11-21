import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";

import { analyzeTypeScriptProject } from "../../../src/analysis/typescript/typescript.analyzer.js";

describe("TypeScript analyzer", () => {
  let repositoryDirectory: string;

  beforeEach(() => {
    repositoryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "ai-code-reviewer-"),
    );
  });

  afterEach(() => {
    fs.rmSync(repositoryDirectory, {
      recursive: true,
      force: true,
    });
  });

  function createTypeScriptConfig(): void {
    const config = {
      compilerOptions: {
        target: "ES2022",
        module: "NodeNext",
        moduleResolution: "NodeNext",
        strict: true,
        skipLibCheck: true,
        types: [],
      },
      include: ["**/*.ts"],
    };

    fs.writeFileSync(
      path.join(repositoryDirectory, "tsconfig.json"),
      JSON.stringify(config, null, 2),
    );
  }

  it("should return no diagnostics for a valid TypeScript project", () => {
    createTypeScriptConfig();

    fs.writeFileSync(
      path.join(repositoryDirectory, "index.ts"),
      'const username: string = "player";',
    );

    const result = analyzeTypeScriptProject(repositoryDirectory);

    expect(result.diagnostics).toEqual([]);
    expect(result.errorCount).toBe(0);
    expect(result.warningCount).toBe(0);
  });

  it("should detect a TypeScript type mismatch", () => {
    createTypeScriptConfig();

    fs.writeFileSync(
      path.join(repositoryDirectory, "index.ts"),
      'const userAge: number = "twenty-five";',
    );

    const result = analyzeTypeScriptProject(repositoryDirectory);

    expect(result.errorCount).toBe(1);
    expect(result.warningCount).toBe(0);

    expect(result.diagnostics).toHaveLength(1);

    expect(result.diagnostics[0]).toMatchObject({
      filePath: "index.ts",
      line: 1,
      column: 7,
      severity: "error",
      code: 2322,
      message: "Type 'string' is not assignable to type 'number'.",
    });
  });

  it("should throw an error when tsconfig.json is missing", () => {
    expect(() => analyzeTypeScriptProject(repositoryDirectory)).toThrow(
      "No tsconfig.json found",
    );
  });
  it("should detect multiple TypeScript errors", () => {
    createTypeScriptConfig();

    fs.writeFileSync(
      path.join(repositoryDirectory, "index.ts"),
      [
        'const age: number = "twenty-five";',
        "const username: string = 123;",
      ].join("\n"),
    );

    const result = analyzeTypeScriptProject(repositoryDirectory);

    expect(result.errorCount).toBe(2);
    expect(result.warningCount).toBe(0);
    expect(result.diagnostics).toHaveLength(2);

    expect(
      result.diagnostics.every((diagnostic) => diagnostic.severity === "error"),
    ).toBe(true);
  });
  it("should return correct relative file paths and positions", () => {
    createTypeScriptConfig();

    const sourceDirectory = path.join(repositoryDirectory, "src", "services");

    fs.mkdirSync(sourceDirectory, {
      recursive: true,
    });

    fs.writeFileSync(
      path.join(sourceDirectory, "user.service.ts"),
      [
        'const username: string = "player";',
        "",
        'const age: number = "invalid";',
      ].join("\n"),
    );

    const result = analyzeTypeScriptProject(repositoryDirectory);

    expect(result.diagnostics).toHaveLength(1);

    expect(result.diagnostics[0]).toMatchObject({
      filePath: "src/services/user.service.ts",
      line: 3,
      column: 7,
      severity: "error",
      code: 2322,
    });
  });
  it("should throw an error for an invalid tsconfig.json", () => {
    fs.writeFileSync(
      path.join(repositoryDirectory, "tsconfig.json"),
      '{"compilerOptions": {"strict": }}',
    );

    expect(() => analyzeTypeScriptProject(repositoryDirectory)).toThrow(
      /Expression expected/i,
    );
  });
  it("should handle diagnostics without a source file", () => {
    fs.writeFileSync(
      path.join(repositoryDirectory, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          types: [],
        },
        files: ["nonexistent.ts"],
      }),
    );

    const result = analyzeTypeScriptProject(repositoryDirectory);

    expect(result.errorCount).toBeGreaterThan(0);

    expect(result.diagnostics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          severity: "error",
          filePath: undefined,
          line: undefined,
          column: undefined,
        }),
      ]),
    );
  });
});
