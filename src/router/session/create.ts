/**
 * 会话重置
 */

import fs from "fs";
import path from "path";
import { sessionDir, ensureDir } from "./utils/storage";

/** 开启新会话 */
export function create(sessionId: string, userId: string): void {
  ensureDir(sessionId);
  fs.writeFileSync(
    path.join(sessionDir(sessionId), "context.json"),
    "[]",
    "utf-8"
  );
}
