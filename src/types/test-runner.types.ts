export type TestRunStatus = "passed" | "failed" | "timed_out";

export interface TestRunOptions {
  repositoryDirectory: string;
  timeoutMs?: number;
}

export interface TestRunResult {
  repositoryDirectory: string;
  command: string;
  status: TestRunStatus;
  exitCode: number | null;
  durationMs: number;
  stdout: string;
  stderr: string;
}
