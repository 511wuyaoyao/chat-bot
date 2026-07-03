/**
 * 群聊运行时上下文
 * 把当前群聊消息的发言人、群号和管理员配置整理成 attention 文本。
 */

import { config } from "../../config";
import { buildGroupChatAttentionPrompt } from "../../prompt";

export interface GroupChatAttentionInput {
  messageType?: "private" | "group";
  groupId?: number;
  userId: string;
  sender?: {
    nickname?: string;
    card?: string;
  };
  category?: string;
}

export function groupChatAttentionText(input: GroupChatAttentionInput): string | undefined {
  if (input.messageType !== "group") return undefined;

  const adminIds = config.qq.adminIds;
  const adminName = config.qq.adminName.trim() || "未配置";
  const adminIdText = adminIds.length > 0 ? adminIds.join("、") : "未配置";
  const isAdmin = adminIds.includes(input.userId);
  const speakerName = senderDisplayName(input);

  return buildGroupChatAttentionPrompt({
    groupId: input.groupId,
    speakerName,
    speakerId: input.userId,
    adminName,
    adminIdText,
    isAdmin,
    isSelfConversation: input.category === "group_self_mention_self",
  });
}

function senderDisplayName(input: GroupChatAttentionInput): string {
  const card = input.sender?.card?.trim();
  const nickname = input.sender?.nickname?.trim();
  return card || nickname || "未知";
}
