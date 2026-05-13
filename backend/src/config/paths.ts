import fs from "node:fs";
import path from "node:path";

const runtimeRoot = process.cwd();

export const uploadsPath = path.resolve(runtimeRoot, "uploads");
export const documentsPath = path.resolve(runtimeRoot, "documents");

export function ensureRuntimeDirectories(): void {
  fs.mkdirSync(uploadsPath, { recursive: true });
  fs.mkdirSync(documentsPath, { recursive: true });
}
