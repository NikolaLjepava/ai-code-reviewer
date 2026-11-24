import { spawn } from "node:child_process";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { resolveNpmCliPath } from "./npm.resolver.js";
import { terminateProcessTree } from "./process.terminator.js";

import type {
  TestRunOptions,
  TestRunResult,
  TestRunStatus,
} from "../types/test-runner.types.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_OUTPUT_BYTES = 1024 * 1024;

export function runTests(options: TestRunOptions): Promise<TestRunResult> {
  const repositoryDirectory = path.resolve(options.repositoryDirectory);

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("timeoutMs must be a positive integer");
  }

  return new Promise((resolve, reject) => {
    const startedAt = performance.now();

    let stdout = "";
    let stderr = "";
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let timedOut = false;
    let settled = false;
    let terminationPromise: Promise<void> | undefined;

    // npm.cmd is required for Windows when shell execution is disabled.
    const npmCliPath = resolveNpmCliPath();

    const child = spawn(process.execPath, [npmCliPath, "test"], {
      cwd: repositoryDirectory,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      detached: process.platform !== "win32",
    });

    const appendOutput = (
      current: string,
      chunk: Buffer,
      bytes: number,
    ): { output: string; bytes: number } => {
      const remaining = Math.max(0, MAX_OUTPUT_BYTES - bytes);
      const captured = chunk.subarray(0, remaining);

      return {
        output: current + captured.toString("utf8"),
        bytes: bytes + captured.length,
      };
    };

    child.stdout.on("data", (chunk: Buffer) => {
      const result = appendOutput(stdout, chunk, stdoutBytes);
      stdout = result.output;
      stdoutBytes = result.bytes;
    });

    child.stderr.on("data", (chunk: Buffer) => {
      const result = appendOutput(stderr, chunk, stderrBytes);
      stderr = result.output;
      stderrBytes = result.bytes;
    });

    const timeout = setTimeout(() => {
      timedOut = true;

      if (child.pid === undefined) {
        return;
      }

      terminationPromise = terminateProcessTree(child.pid).catch(
        (error: unknown) => {
          if (settled) {
            return;
          }

          settled = true;

          child.kill();
          child.stdout.destroy();
          child.stderr.destroy();

          reject(
            new Error("Failed to terminate test process tree", {
              cause: error,
            }),
          );
        },
      );
    }, timeoutMs);

    child.on("error", (error) => {
      clearTimeout(timeout);

      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    child.on("close", async (exitCode) => {
      clearTimeout(timeout);

      if (terminationPromise) {
        await terminationPromise;
      }

      if (settled) {
        return;
      }

      settled = true;

      const status: TestRunStatus = timedOut
        ? "timed_out"
        : exitCode === 0
          ? "passed"
          : "failed";

      resolve({
        repositoryDirectory,
        command: "npm test",
        status,
        exitCode,
        durationMs: Math.round(performance.now() - startedAt),
        stdout,
        stderr,
      });
    });
  });
}
