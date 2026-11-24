import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { runTests } from "../../src/testing/test.runner.js";

describe("Test Runner", () => {
  let repositoryDirectory: string;

  beforeEach(() => {
    repositoryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), "ai-code-reviewer-test-"),
    );
  });

  afterEach(() => {
    fs.rmSync(repositoryDirectory, {
      recursive: true,
      force: true,
    });
  });

  function createTestProject(scriptContent: string): void {
    fs.writeFileSync(
      path.join(repositoryDirectory, "package.json"),
      JSON.stringify({
        name: "test-project",
        version: "1.0.0",
        private: true,
        scripts: {
          test: "node test.cjs",
        },
      }),
    );

    fs.writeFileSync(path.join(repositoryDirectory, "test.cjs"), scriptContent);
  }

  it("should return passed when tests succeed", async () => {
    createTestProject("console.log('Tests passed');");

    const result = await runTests({ repositoryDirectory });

    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
    expect(result.command).toBe("npm test");
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("should return failed when tests fail", async () => {
    createTestProject("process.exit(1);");

    const result = await runTests({ repositoryDirectory });

    expect(result.status).toBe("failed");
    expect(result.exitCode).toBe(1);
  });

  it("should capture standard output", async () => {
    createTestProject("console.log('Expected stdout');");

    const result = await runTests({ repositoryDirectory });

    expect(result.stdout).toContain("Expected stdout");
  });

  it("should capture standard error without treating it as a failure", async () => {
    createTestProject("console.error('Expected stderr');");

    const result = await runTests({ repositoryDirectory });

    expect(result.stderr).toContain("Expected stderr");
    expect(result.status).toBe("passed");
    expect(result.exitCode).toBe(0);
  });

  it("should return timed_out when execution exceeds the timeout", async () => {
    createTestProject("setInterval(() => {}, 1000);");

    const result = await runTests({
      repositoryDirectory,
      timeoutMs: 2000,
    });

    expect(result.status).toBe("timed_out");
    expect(result.durationMs).toBeGreaterThanOrEqual(1900);
    expect(result.durationMs).toBeLessThan(10000);
  }, 15000);

  it("should reject an invalid timeout", () => {
    expect(() =>
      runTests({
        repositoryDirectory,
        timeoutMs: -1000,
      }),
    ).toThrow("timeoutMs must be a positive integer");
  });

  it("should reject a nonexistent repository directory", async () => {
    await expect(
      runTests({
        repositoryDirectory: path.join(repositoryDirectory, "nonexistent"),
      }),
    ).rejects.toThrow();
  });

  it("should limit captured output", async () => {
    createTestProject("process.stdout.write('a'.repeat(2 * 1024 * 1024));");

    const result = await runTests({ repositoryDirectory });

    expect(result.status).toBe("passed");
    expect(Buffer.byteLength(result.stdout, "utf8")).toBe(1024 * 1024);
  });
  it("should terminate descendant processes when execution times out", async () => {
    const pidFile = path.join(repositoryDirectory, "child.pid");

    createTestProject(`
    const fs = require("node:fs");

    fs.writeFileSync(
      "child.pid",
      String(process.pid)
    );

    setInterval(() => {}, 1000);
  `);

    const result = await runTests({
      repositoryDirectory,
      timeoutMs: 3000,
    });

    expect(result.status).toBe("timed_out");
    expect(fs.existsSync(pidFile)).toBe(true);

    const pid = Number(fs.readFileSync(pidFile, "utf8"));

    expect(Number.isSafeInteger(pid)).toBe(true);
    expect(pid).toBeGreaterThan(0);

    expect(() => process.kill(pid, 0)).toThrow(
      expect.objectContaining({
        code: "ESRCH",
      }),
    );
  }, 15000);
});
