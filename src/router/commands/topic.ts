/**
 * /topic — 直接与话题管家对话
 * 复用 topic-agent 同一套 prompt + 上下文，不单独建 topic-chat
 */

import path from "path";
import { commandRegistry } from "./registry";
import { getOrCreateSession } from "../data-index";
import { agentLoop } from "../../agent/agent-loop";
import { pushTopic } from "../../agent/attention/topic_queue";
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

commandRegistry.register({
  name: "topic",
  description: "与话题管家对话，查看/管理追踪中的话题",
  async execute(userId: string, args: string[]): Promise<string> {
    const mainSid = getOrCreateSession(userId);
    const userText = args.join(" ").trim() || "展示当前追踪话题列表";
    const topicText = [
      "【当前模式：主动对话】",
      `用户：${userText}`,
    ].join("\n");

    const sessionId = `${mainSid}_topic`;
    const storageDir = path.join(DATA_ROOT, userId, "session", mainSid, "topic");

    try {
      const reply = await agentLoop(sessionId, userId, topicText, undefined, {
        systemPrompt: PROMPT_TOPIC,
        tools: getTools(),
        actor: "topic-agent",
        mainSessionId: mainSid,
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
