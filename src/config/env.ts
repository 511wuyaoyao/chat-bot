/**
 * 环境变量文件自动加载入口，只扫描项目根目录下的 env/ 文件夹。
 */

import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envDir = path.join(process.cwd(), "env");
const baseEnvFile = path.join(envDir, ".env");
const localEnvFile = path.join(envDir, ".env.local");
const envFiles = discoverEnvFiles(envDir).filter((file) => file !== baseEnvFile && file !== localEnvFile);

loadEnvFile(baseEnvFile);

for (const file of envFiles) {
  loadEnvFile(file);
}

loadEnvFile(baseEnvFile);
loadEnvFile(localEnvFile);

function loadEnvFile(file: string): void {
  if (!fs.existsSync(file)) return;
  dotenv.config({ path: file, override: true });
}

function discoverEnvFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name === ".env" || name.startsWith(".env."))
    .filter((name) => !name.endsWith(".example"))
    .sort()
    .map((name) => path.join(dir, name));
}
