/**
 * 消息队列 — 运输 + 编排
 * 依赖 router 做业务路由，负责串行、中断、撤回、进度、归档
 */

import { QqMessage, QqAdapter } from "../qq/adapter";
import { messageRouter } from "./message-router";
import { getOrCreateSession } from "./data-index";
import { set as archiveSet } from "./archive/set";
import { handleRecall } from "./recall";
import { logger } from "../utils/logger";

/** 记录 QQ message_id → sessionId，用于撤回时定位 */
interface MessageRecord {
  sessionId: string;
}

/** 已撤回的 message_id 集合，供 agentLoop 查询是否需要中止 */
const recalledIds = new Set<number>();

/** agentLoop 调用：检查当前处理的消息是否已被撤回 */
export function isRecalled(messageId: number): boolean {
  return recalledIds.has(messageId);
}

export class MessageQueue {
  private pending: QqMessage[] = [];
  private running = false;
  private controller: AbortController | null = null;
  private currentMsg: QqMessage | null = null;
  private adapter: QqAdapter | null = null;
  /** message_id → 会话记录 */
  private messageMap = new Map<number, MessageRecord>();

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
    const sid = getOrCreateSession(uid);
    archiveSet(sid, { role: "user", content: msg.raw_message });

    // 记录 message_id → session，供撤回使用
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
    // 队列层职责：清理 pending + 中断当前
    this.pending = this.pending.filter((m) => m.message_id !== messageId);

    if (this.currentMsg?.message_id === messageId && this.controller) {
      logger.debug("当前处理的消息被撤回，终止回复");
      this.controller.abort();
    }

    // 标记为已撤回，agentLoop 查询此集合决定是否中止
    recalledIds.add(messageId);

    // 存储层职责：委托 router 处理（归档撤回日志 + 删 session 上下文）
    const record = this.messageMap.get(messageId);
    if (!record) {
      return;
    }

    handleRecall(userId, record.sessionId, messageId);

    this.messageMap.delete(messageId);
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
