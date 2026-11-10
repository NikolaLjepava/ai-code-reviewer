import { getGitRepositoryInfo } from "./git/git.repository.js";

async function main(): Promise<void> {
  console.log("AI Code Reviewer started.");

  const repository = await getGitRepositoryInfo();

  console.log("\nGit repository detected:");
  console.log(`Root directory: ${repository.rootDirectory}`);
  console.log(`Current branch: ${repository.currentBranch}`);
}

main().catch((error: unknown) => {
  console.error("Application failed:", error);
  process.exitCode = 1;
});
