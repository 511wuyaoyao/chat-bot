/**
 * 消息队列：负责串行处理、引用中断、撤回和归档。
 */

import { InternalMessage, Platform } from "../platform/output";
import { messageRouter } from "./message-router";
import { getOrCreateSession } from "./data-index";
import { set as archiveSet } from "./archive/set";
import { handleRecall } from "./recall";
import { logger } from "../utils/logger";

interface MessageRecord {
  sessionId: string;
}

const recalledIds = new Set<number>();

export function isRecalled(messageId: number): boolean {
  return recalledIds.has(messageId);
}

export class MessageQueue {
  private pending: InternalMessage[] = [];
  private running = false;
  private controller: AbortController | null = null;
  private currentMsg: InternalMessage | null = null;
  private platform: Platform | null = null;
  private messageMap = new Map<number, MessageRecord>();

  setAdapter(platform: Platform): void {
    this.platform = platform;
  }

  private getPlatform(): Platform {
    if (!this.platform) throw new Error("MessageQueue: platform 未注入");
    return this.platform;
  }

  enqueue(msg: InternalMessage): void {
    const uid = String(msg.user_id);
    if (isRecalled(msg.message_id)) {
      logger.debug("skip recalled message enqueue", { user_id: uid, recalled_message_id: msg.message_id });
      return;
    }

    this.pending.push(msg);

    const sid = getOrCreateSession(uid);
    archiveSet(sid, { role: "user", content: msg.raw_message });

    this.messageMap.set(msg.message_id, { sessionId: sid });

    if (msg.reply && this.controller) {
      logger.debug("收到引用回复，中断当前 Agent 处理");
      this.controller.abort();
    }

    if (!this.running) {
      this.running = true;
      this.consume().finally(() => { this.running = false; });
    }
  }

  recall(userId: string, messageId: number): void {
    const currentMessageId = this.currentMsg?.message_id;
    const matched = currentMessageId === messageId;
    logger.info("recall event received", {
      user_id: userId,
      recalled_message_id: messageId,
      current_message_id: currentMessageId,
      matched,
    });

    this.pending = this.pending.filter((m) => m.message_id !== messageId);

    if (matched && this.controller) {
      logger.debug("abort current message after recall", {
        recalled_message_id: messageId,
        current_message_id: currentMessageId,
        matched,
      });
      this.controller.abort();
    }

    recalledIds.add(messageId);

    const record = this.messageMap.get(messageId);
    if (!record) return;

    handleRecall(userId, record.sessionId, messageId);
    this.messageMap.delete(messageId);
  }

  private async consume(): Promise<void> {
    while (this.pending.length > 0) {
      const msg = this.pending.shift()!;
      if (isRecalled(msg.message_id)) {
        logger.debug("skip recalled message processing", { recalled_message_id: msg.message_id });
        continue;
      }

      this.currentMsg = msg;
      this.controller = new AbortController();
      const controller = this.controller;
      const signal = controller.signal;
      const uid = String(msg.user_id);
      const progressMsgIds: number[] = [];
      const shouldStop = () => signal.aborted || isRecalled(msg.message_id);

      try {
        const reply = await messageRouter(
          msg,
          async (_toolName, desc) => {
            if (shouldStop()) return;
            const id = await this.getPlatform().sendMessage(msg.message_type, uid, desc, msg.group_id);
            if (!id) return;
            progressMsgIds.push(id);
            if (shouldStop()) await this.getPlatform().recallMessage(id);
          },
          signal
        );

        if (!shouldStop() && reply.reply) {
          const replyMessageId = await this.getPlatform().sendMessage(msg.message_type, uid, reply.reply, msg.group_id);
          if (shouldStop() && replyMessageId) {
            await this.getPlatform().recallMessage(replyMessageId);
          } else {
            reply.onReplySent?.(replyMessageId);
          }
        }
      } catch (err) {
        if (!shouldStop()) {
          logger.error("message processing failed", { error: String(err) });
        }
      } finally {
        for (const id of progressMsgIds) await this.getPlatform().recallMessage(id);
      }

      this.currentMsg = null;
      if (this.controller === controller) this.controller = null;
    }
  }

}
