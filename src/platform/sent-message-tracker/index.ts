/**
 * 自发消息追踪器。
 * 记录 adapter 发送出去的消息 ID，并在后续普通 message 回流时消费。
 */

const MAX_TRACKED_MESSAGE_IDS = 500;

export class SentMessageTracker {
  private messageIds: number[] = [];
  private messageIdSet = new Set<number>();

  remember(messageId: number): void {
    this.messageIds.push(messageId);
    this.messageIdSet.add(messageId);

    while (this.messageIds.length > MAX_TRACKED_MESSAGE_IDS) {
      const old = this.messageIds.shift();
      if (old !== undefined) this.messageIdSet.delete(old);
    }
  }

  consume(messageId: number): boolean {
    if (!messageId || !this.messageIdSet.has(messageId)) return false;

    this.messageIdSet.delete(messageId);
    this.messageIds = this.messageIds.filter((id) => id !== messageId);
    return true;
  }
}
