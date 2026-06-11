/**
 * 消息队列 — 运输 + 编排
 * 依赖 router 做业务路由，负责串行、中断、撤回、进度、归档
 */

import { QqMessage, QqAdapter } from "../qq/adapter";
import { messageRouter } from "./message-router";
import { getOrCreateSession } from "./session/manage";
import { set as archiveSet } from "./archive/set";
import { logger } from "../utils/logger";

export class MessageQueue {
  private pending: QqMessage[] = [];
  private running = false;
  private controller: AbortController | null = null;
  private currentMsg: QqMessage | null = null;
  private adapter: QqAdapter | null = null;

  setAdapter(adapter: QqAdapter): void {
    this.adapter = adapter;
  }

  private getAdapter(): QqAdapter {
    if (!this.adapter) throw new Error("MessageQueue: adapter 未注入");
    return this.adapter;
  }

  enqueue(msg: QqMessage): void {
    this.pending.push(msg);

    // 入队即归档
    const uid = String(msg.user_id);
    archiveSet(getOrCreateSession(uid), { role: "user", content: msg.raw_message });

    if (msg.reply && this.controller) {
      logger.debug("收到引用回复，中断当前 Agent 处理");
      this.controller.abort();
    }

    if (!this.running) {
      this.running = true;
      this.consume().finally(() => { this.running = false; });
    }
  }

  recall(messageId: number): void {
    this.pending = this.pending.filter((m) => m.message_id !== messageId);
    if (this.currentMsg?.message_id === messageId && this.controller) {
      logger.debug("当前处理的消息被撤回，终止回复");
      this.controller.abort();
    }
  }

  private async consume(): Promise<void> {
    while (this.pending.length > 0) {
      const msg = this.pending.shift()!;
      this.currentMsg = msg;
      this.controller = new AbortController();
      const uid = String(msg.user_id);
      const progressMsgIds: number[] = [];

      try {
        const reply = await messageRouter(
          msg,
          async (_toolName, desc) => {
            if (this.controller!.signal.aborted) return;
            const id = await this.getAdapter().sendMessage(msg.message_type, uid, desc, msg.group_id);
            if (id) progressMsgIds.push(id);
          },
          async (text) => this.getAdapter().sendMessage(msg.message_type, uid, text, msg.group_id)
        );

        if (!this.controller.signal.aborted && reply) {
          await this.getAdapter().sendMessage(msg.message_type, uid, reply, msg.group_id);
        }
      } catch (err) {
        if (!this.controller.signal.aborted) {
          logger.error("消息处理异常", { error: String(err) });
        }
      } finally {
        if (!this.controller.signal.aborted) {
          for (const id of progressMsgIds) await this.getAdapter().recallMessage(id);
        }
      }

      this.currentMsg = null;
      this.controller = null;
    }
  }
}
