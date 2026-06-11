/**
 * push_topic 工具 — 将话题写入队列
 * 注册到全局工具目录，由 Topic Agent 选用执行
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";
import { pushTopic } from "../../agent/attention/topic_queue";

function pushTopicTool(): ToolHandler {
  return {
    definition: {
      type: "function",
      function: {
        name: "push_topic",
        description:
          "将话题写入队列。persist 三选一：yes=主动跟踪，ask=不确定需询问用户，no=仅记录不跟踪。" +
          "persist=ask 时必须先调 ask_user 发送确认消息，拿到 message_id 后再传 askMessageId。",
        parameters: {
          type: "object",
          properties: {
            topic: { type: "string", description: "话题摘要，一句话" },
            source: { type: "string", description: "来源简述" },
            summary: { type: "string", description: "本轮对话核心内容总结（2-3句）" },
            persist: { type: "string", enum: ["yes", "ask", "no"] },
            askMessageId: { type: "integer", description: "ask_user 返回的 message_id" },
          },
          required: ["topic", "source", "summary", "persist"],
        },
      },
    },
    async execute(args: Record<string, unknown>, userId: string) {
      // mainSessionId 由 Topic Agent 在执行时注入，此处 fallback
      const added = pushTopic(
        userId, "",
        String(args.topic), String(args.source), String(args.summary),
        String(args.persist) as "yes" | "ask" | "no",
        args.askMessageId as number | undefined
      );
      return { added, topic: args.topic, persist: args.persist };
    },
  };
}

toolRegistry.register(pushTopicTool());
