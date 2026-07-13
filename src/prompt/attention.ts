/**
 * Attention 提示词文案
 * 只存放 attention 注入给模型时使用的固定提示词。
 */

export function buildAttentionSystemContent(attentionText: string): string {
  return [
    attentionText,
  ].join("\n");
}

export interface GroupChatAttentionPromptInput {
  groupId?: number;
  speakerName: string;
  speakerId: string;
  adminName: string;
  adminIdText: string;
  isAdmin: boolean;
  isSelfConversation: boolean;
}

export function buildGroupChatAttentionPrompt(input: GroupChatAttentionPromptInput): string {
  const lines = [
    "当前消息来自群聊。",
    `群号：${input.groupId ?? "未知"}`,
    `当前发言人名称：${input.speakerName || "未知"}`,
    `当前发言人 QQ：${input.speakerId}`,
    `Agent 管理员名称：${input.adminName}`,
    `Agent 管理员 QQ 列表：${input.adminIdText}`,
    `当前发言人是否为 Agent 管理员：${input.isAdmin ? "是" : "否"}`,
  ];

  if (input.isSelfConversation) {
    lines.push("当前消息由 Agent 所在 QQ 账号在群聊中发出，可视为群聊里的手动自对话。");
  }

  return lines.join("\n");
}
