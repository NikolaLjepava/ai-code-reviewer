import * as ts from "typescript";
import path from "node:path";

import type {
  DiagnosticSeverity,
  TypeScriptAnalysisResult,
  TypeScriptDiagnostic,
} from "../../types/typescript.types.js";

/**
 * Analyzes a TypeScript project using the TypeScript Compiler API.
 */
export function analyzeTypeScriptProject(
  repositoryDirectory: string,
): TypeScriptAnalysisResult {
  const absoluteRepositoryDirectory = path.resolve(repositoryDirectory);
  // Normalize native path separators for TypeScript Compiler API compatibility.
  const configPath = path
    .join(absoluteRepositoryDirectory, "tsconfig.json")
    .split(path.sep)
    .join("/");

  // Check whether the target repository has a TypeScript configuration.
  if (!ts.sys.fileExists(configPath)) {
    throw new Error(
      `No tsconfig.json found in: ${absoluteRepositoryDirectory}`,
    );
  }

  // Read the TypeScript configuration.
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

  if (configFile.error) {
    throw new Error(
      ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"),
    );
  }

  // Parse the configuration into compiler options and source files.
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    absoluteRepositoryDirectory,
  );

  // Create a TypeScript program representing the target project.
  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  // Collect configuration and compiler diagnostics.
  const compilerDiagnostics = [
    ...parsedConfig.errors,
    ...ts.getPreEmitDiagnostics(program),
  ];

  const diagnostics: TypeScriptDiagnostic[] = compilerDiagnostics.map(
    (diagnostic) => {
      let filePath: string | undefined;
      let line: number | undefined;
      let column: number | undefined;

      if (diagnostic.file && diagnostic.start !== undefined) {
        const position = diagnostic.file.getLineAndCharacterOfPosition(
          diagnostic.start,
        );

        filePath = path
          .relative(absoluteRepositoryDirectory, diagnostic.file.fileName)
          .replace(/\\/g, "/");

        // Convert zero-based positions to one-based positions.
        line = position.line + 1;
        column = position.character + 1;
      }

      const severity: DiagnosticSeverity =
        diagnostic.category === ts.DiagnosticCategory.Error
          ? "error"
          : diagnostic.category === ts.DiagnosticCategory.Warning
            ? "warning"
            : "info";

      return {
        filePath,
        line,
        column,
        severity,
        code: diagnostic.code,
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
      };
    },
  );

  return {
    repositoryDirectory: absoluteRepositoryDirectory,
    diagnostics,
    errorCount: diagnostics.filter(
      (diagnostic) => diagnostic.severity === "error",
    ).length,
    warningCount: diagnostics.filter(
      (diagnostic) => diagnostic.severity === "warning",
    ).length,
  };
}
