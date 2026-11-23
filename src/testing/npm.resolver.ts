import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function resolveNpmCliPath(): string {
  const isWindows = process.platform === "win32";

  const executable = isWindows ? "where.exe" : "which";

  const npmExecutable = isWindows ? "npm.cmd" : "npm";

  const output = execFileSync(executable, [npmExecutable], {
    encoding: "utf8",
  });

  const npmPath = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!npmPath) {
    throw new Error("Could not locate npm executable");
  }

  const resolvedPath = fs.realpathSync(npmPath);

  const npmDirectory = path.dirname(resolvedPath);

  const candidates = isWindows
    ? [path.join(npmDirectory, "node_modules", "npm", "bin", "npm-cli.js")]
    : [
        path.resolve(npmDirectory, "../lib/node_modules/npm/bin/npm-cli.js"),
        path.resolve(npmDirectory, "../node_modules/npm/bin/npm-cli.js"),
      ];

  const npmCliPath = candidates.find((candidate) => fs.existsSync(candidate));

  if (!npmCliPath) {
    throw new Error("Could not locate npm CLI JavaScript entry point");
  }

  return npmCliPath;
}
