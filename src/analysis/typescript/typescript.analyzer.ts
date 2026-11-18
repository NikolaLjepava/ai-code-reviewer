import ts from "typescript";
import path from "node:path";

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface TypeScriptDiagnostic {
  filePath?: string;
  line?: number;
  column?: number;
  severity: DiagnosticSeverity;
  code: number;
  message: string;
}

export interface TypeScriptAnalysisResult {
  repositoryDirectory: string;
  diagnostics: TypeScriptDiagnostic[];
  errorCount: number;
  warningCount: number;
}
