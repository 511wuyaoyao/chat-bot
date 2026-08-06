/**
 * 自聊回声过滤器。
 * 用于处理 bot 私聊发送给自己后，又被实现端回流成普通 message 的场景。
 */

import type { InternalMessage } from "./internal";

interface SelfChatEcho {
  content: string;
  timestamp: number;
}

const MAX_RECENT_ECHOES = 5;

export class SelfChatEchoFilter {
  private recent: SelfChatEcho[] = [];

  remember(content: string): void {
    const normalized = normalizeContent(content);
    if (!normalized) return;

    this.recent.push({
      content: normalized,
      timestamp: Date.now(),
    });

    while (this.recent.length > MAX_RECENT_ECHOES) {
      this.recent.shift();
    }
  }

  forget(content: string): void {
    const normalized = normalizeContent(content);
    const index = this.recent.findIndex((item) => item.content === normalized);
    if (index >= 0) this.recent.splice(index, 1);
  }

  consumeIfEcho(msg: InternalMessage): boolean {
    if (!isSelfPrivateMessage(msg)) return false;

    const normalized = normalizeContent(msg.raw_message);
    const index = this.recent.findIndex((item) => item.content === normalized);
    if (index < 0) return false;

    this.recent.splice(index, 1);
    return true;
  }
}

function isSelfPrivateMessage(msg: InternalMessage): boolean {
  return (
    msg.message_type === "private" &&
    msg.is_self_sent === true &&
    String(msg.private_peer_id || "") === String(msg.self_id || "")
  );
}

function normalizeContent(content: string): string {
  return content.trim();
}
