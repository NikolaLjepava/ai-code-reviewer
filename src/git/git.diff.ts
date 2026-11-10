import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * Returns the names of files changed compared with a base branch.
 */
export async function getChangedFiles(
  baseBranch: string = "main",
  repositoryDirectory: string = process.cwd(),
): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--name-only", "--diff-filter=ACMRTD", baseBranch],
      { cwd: repositoryDirectory },
    );

    return stdout.trim().split(/\r?\n/).filter(Boolean);
  } catch {
    throw new Error(
      `Could not retrieve changed files compared with branch: ${baseBranch}`,
    );
  }
}

/**
 * Returns the actual code differences compared with a base branch.
 */
export async function getDiff(
  baseBranch: string = "main",
  repositoryDirectory: string = process.cwd(),
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["diff", "--no-ext-diff", "--unified=3", baseBranch],
      {
        cwd: repositoryDirectory,
        maxBuffer: 10 * 1024 * 1024,
      },
    );

    return stdout;
  } catch {
    throw new Error(
      `Could not retrieve Git diff compared with branch: ${baseBranch}`,
    );
  }
}
