import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

const execFileAsync = promisify(execFile);

export interface GitRepositoryInfo {
  rootDirectory: string;
  currentBranch: string;
}

export async function getGitRepositoryInfo(
  startingDirectory: string = process.cwd(),
): Promise<GitRepositoryInfo> {
  try {
    const { stdout: rootDirectory } = await execFileAsync(
      "git",
      ["rev-parse", "--show-toplevel"],
      { cwd: startingDirectory },
    );

    const { stdout: currentBranch } = await execFileAsync(
      "git",
      ["rev-parse", "--abbrev-ref", "HEAD"],
      { cwd: startingDirectory },
    );

    return {
      rootDirectory: path.resolve(rootDirectory.trim()),
      currentBranch: currentBranch.trim(),
    };
  } catch {
    throw new Error(
      `Could not detect a Git repository from: ${startingDirectory}`,
    );
  }
}
