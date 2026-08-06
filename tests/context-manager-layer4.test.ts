/**
 * 测试 topic-agent 第四层上下文压缩预留行为。
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { clearContextCompactionCooldownForTest, maybeCompactContext } from "../src/router/session/context-manager";
import { getCache } from "../src/router/session/set";
import type { StoredMessage } from "../src/router/session/utils/types";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "qqbot-context-l4-"));
}

function writeContext(baseDir: string, messages: StoredMessage[]): void {
  fs.mkdirSync(baseDir, { recursive: true });
  fs.writeFileSync(path.join(baseDir, "context.json"), JSON.stringify(messages, null, 2), "utf-8");
}

test("topic-agent 第四层压缩先作为空实现预留", () => {
  clearContextCompactionCooldownForTest();
  const baseDir = tmpDir();
  const sessionId = "u_topic_l4";
  writeContext(baseDir, [
    { role: "assistant", content: "a0", deleted: true, deletedReason: "topic_no_persist" },
    { role: "assistant", content: "a1", deleted: true, deletedReason: "topic_no_persist" },
    { role: "assistant", content: "a2", deleted: true, deletedReason: "topic_no_persist" },
  ]);

  const result = maybeCompactContext({
    sessionId,
    actor: "topic-agent",
    usage: { prompt_tokens: 16_000 },
    baseDir,
  });
  const updated = getCache(sessionId, baseDir);

  assert.equal(result.reason, "not_implemented");
  assert.equal(result.layer, 4);
  assert.equal(result.changed, 0);
  assert.equal(updated.length, 3);
});
