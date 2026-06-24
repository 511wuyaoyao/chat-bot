/**
 * Topic Agent
 * 独立消费者：从对话队列取一轮对话 → 分析 → push_topic
 * 上下文存储在 session/{mainSessionId}/topic/
 * 一个 main 会话生命周期内复用同一个 topic 会话
 */

import path from "path";
import { agentLoop } from "../../agent-loop";
import { pushTopic, getAllTopics, TopicEntry } from "../../attention/topic_queue";
import { toolRegistry, ToolDefinition } from "../../tool-registry";
import { logger } from "../../../utils/logger";
import { PROMPT_TOPIC } from "../../../prompt";
import type { DialogueItem } from "./queue";

const DATA_ROOT = path.resolve(process.cwd(), "data");

/** Topic Agent 工具：话题 + 知识库读写 */
const SELECTED = [
  "push_topic",
  "get_tree",
  "get_entry",
  "add_entry",
  "update_entry",
  "delete_entry",
  "create_folder",
  "update_folder",
  "delete_folder",
  "delete_file",
];

function getTopicTools(): ToolDefinition[] {
  return SELECTED.map((name) => {
    const def = toolRegistry.getDefinitions().find((d) => d.function.name === name);
    if (!def) throw new Error(`Topic Agent 选用了未注册的工具: ${name}`);
    return def;
  });
}

/** 格式化话题列表用于注入 prompt */
function formatTopics(topics: TopicEntry[]): string {
  if (topics.length === 0) return "（暂无追踪话题）";
  return topics.map((t) =>
    `- ${t.topic} [${t.persist}] ${t.createdAt} | ${t.summary}`
  ).join("\n");
}

function buildPrompt(userId: string, mainSessionId: string): string {
  const topics = getAllTopics(userId, mainSessionId);
  return PROMPT_TOPIC.replace("{topics}", formatTopics(topics));
}

export async function topicAgent(
  userId: string,
  mainSessionId: string,
  dialogue: DialogueItem
): Promise<void> {
  const sessionId = `${mainSessionId}_topic`;

  try {
    const text = `用户：${dialogue.userMessage}\n助手：${dialogue.assistantReply}`;

    const storageDir = path.join(DATA_ROOT, userId, "session", mainSessionId, "topic");

    await agentLoop(sessionId, userId, text, undefined, {
      systemPrompt: buildPrompt(userId, mainSessionId),
      tools: getTopicTools(),
      storageDir,
      executeTool: async (name, args) => {
        if (name === "push_topic") {
          const added = pushTopic(
            userId, mainSessionId,
            String(args.topic), String(args.source), String(args.summary),
            String(args.persist) as "yes" | "ask" | "no",
            args.askMessageId as number | undefined
          );
          return { added, topic: args.topic, persist: args.persist };
        }
        return toolRegistry.execute(name, args, userId);
      },
    });
  } catch (err) {
    logger.debug("Topic Agent 失败", { error: String(err) });
  }
}
