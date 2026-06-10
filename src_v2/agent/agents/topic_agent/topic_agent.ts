/**
 * 话题 Agent
 * 静默运行 — 审视近期对话，提炼值得长期跟踪的话题写入队列
 * 不直接对用户说话
 */

import { agentLoop } from "../../agent-loop";
import { pushTopic } from "../../attention_prompt/topic_queue";
import { create } from "../../../../src/router/session/create";

const PROMPT_TOPIC = `你是话题提炼员。审视对话，找出值得长期跟踪的话题。你**静默运行**，你的输出是对系统的结构化反馈，不是对用户说话。

判断标准 — 以下信号代表"值得记"：
- 用户表达了偏好、计划、新兴趣（"想学xxx"、"最近在关注xxx"）
- 用户分享了持续性的信息（职业变动、生活状态变化）
- 用户对某领域的重复提及（说明是长期关注点）

以下不需要记：
- 问候、道别、"ok"、"谢谢"
- 一次性查询（"今天天气"）
- 纯闲聊
- 已经在队列中的话题（不要重复）

工具使用
调用 push_topic(topic, source) 将话题写入队列。
topic 用一句话概括，source 简记来源回合。
如果没有值得记的话题，不调任何工具，直接回复空即可。`;

export async function topicAgent(
  userId: string,
  dialogue: string
): Promise<void> {
  const sessionId = `${userId}_topic_${Date.now()}`;
  create(sessionId, userId);

  await agentLoop({
    sessionId,
    userId,
    text: `以下是最新一轮对话。审视并判断是否有值得加入话题队列的内容：\n\n${dialogue}`,
    systemPrompt: PROMPT_TOPIC,
    tools: [PUSH_TOPIC_DEF],
    executeTool: async (name, args) => {
      if (name === "push_topic") {
        return { added: pushTopic(userId, String(args.topic), String(args.source)) };
      }
      return { error: `未知工具 ${name}` };
    },
    persistToolCalls: false,
  });
}

const PUSH_TOPIC_DEF = {
  type: "function" as const,
  function: {
    name: "push_topic",
    description: "将值得长期跟踪的话题写入队列。不要重复已有话题。",
    parameters: {
      type: "object",
      properties: {
        topic: { type: "string", description: "话题摘要，一句话" },
        source: { type: "string", description: "来源简述，如'用户提到想学Blender'" },
      },
      required: ["topic", "source"],
    },
  },
};
