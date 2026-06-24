/**
 * /topic — 直接与话题管家对话
 * 复用 topic-agent 同一套 prompt + 上下文，不单独建 topic-chat
 */

import path from "path";
import { commandRegistry } from "./registry";
import { getOrCreateSession } from "../data-index";
import { agentLoop } from "../../agent/agent-loop";
import { pushTopic, getAllTopics, TopicEntry } from "../../agent/attention/topic_queue";
import { toolRegistry, ToolDefinition } from "../../agent/tool-registry";
import { PROMPT_TOPIC } from "../../prompt";
import { logger } from "../../utils/logger";

const DATA_ROOT = path.resolve(process.cwd(), "data");

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

function getTools(): ToolDefinition[] {
  return SELECTED.map((name) => {
    const def = toolRegistry.getDefinitions().find((d) => d.function.name === name);
    if (!def) throw new Error(`Topic 选用了未注册的工具: ${name}`);
    return def;
  });
}

function formatTopics(topics: TopicEntry[]): string {
  if (topics.length === 0) return "（暂无追踪话题）";
  return topics.map((t) =>
    `- ${t.topic} [${t.persist}] ${t.createdAt} | ${t.summary}`
  ).join("\n");
}

commandRegistry.register({
  name: "topic",
  description: "与话题管家对话，查看/管理追踪中的话题",
  async execute(userId: string, args: string[]): Promise<string> {
    const mainSid = getOrCreateSession(userId);
    const userText = args.join(" ").trim();

    const sessionId = `${mainSid}_topic`;
    const storageDir = path.join(DATA_ROOT, userId, "session", mainSid, "topic");

    const systemPrompt = PROMPT_TOPIC.replace(
      "{topics}",
      formatTopics(getAllTopics(userId, mainSid))
    );

    try {
      const reply = await agentLoop(sessionId, userId, userText, undefined, {
        systemPrompt,
        tools: getTools(),
        storageDir,
        executeTool: async (name, args) => {
          if (name === "push_topic") {
            const added = pushTopic(
              userId, mainSid,
              String(args.topic), String(args.source), String(args.summary),
              String(args.persist) as "yes" | "ask" | "no",
              args.askMessageId as number | undefined
            );
            return { added, topic: args.topic, persist: args.persist };
          }
          return toolRegistry.execute(name, args, userId);
        },
      });
      return reply;
    } catch (err) {
      logger.warn("Topic 命令失败", { error: String(err) });
      return "话题管家暂时不可用。";
    }
  },
});
