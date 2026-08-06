/**
 * Topic Agent
 * 独立消费者：从对话队列取一轮对话 → 分析 → push_topic
 * 上下文存储在 session/{mainSessionId}/topic/
 * 一个 main 会话生命周期内复用同一个 topic 会话
 */

import path from "path";
import { agentLoop } from "../../agent-loop";
import { pushTopic } from "../../attention/topic_queue";
import { toolRegistry, ToolDefinition } from "../../tool-registry";
import { logger } from "../../../utils/logger";
import { buildPromptTopic } from "../../../prompt";
import { config } from "../../../config/output";
import type { DialogueItem } from "./queue";
import {
  latestAssistantUsageSince,
  updateLatestAssistantCompactionHintsSince,
  updateMessageTopicByMessageIds,
} from "../../../router/session/set";
import { maybeCompactContext } from "../../../router/session/context-manager";
import type { StoredMessage } from "../../../router/session/utils/types";

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

function buildPassiveAnalysisText(dialogue: DialogueItem): string {
  return [
    "【当前模式：被动分析】",
    `用户：${dialogue.userMessage}`,
    `助手：${dialogue.assistantReply}`,
  ].join("\n");
}

export async function topicAgent(
  userId: string,
  mainSessionId: string,
  dialogue: DialogueItem
): Promise<void> {
  const sessionId = `${mainSessionId}_topic`;

  try {
    const text = buildPassiveAnalysisText(dialogue);

    const storageDir = path.join(DATA_ROOT, userId, "session", mainSessionId, "topic");
    const startedAt = Date.now();
    const compactionHints: NonNullable<StoredMessage["compactionHints"]> = {};
    const tools = getTopicTools();

    await agentLoop(sessionId, userId, text, undefined, {
      systemPrompt: buildPromptTopic(tools),
      tools,
      actor: "topic-agent",
      mainSessionId,
      storageDir,
      maxIterations: config.topic.maxIterations,
      model: config.topic.model,
      temperature: config.topic.temperature,
      maxTokens: config.topic.maxTokens,
      executeTool: async (name, args) => {
        if (name === "push_topic") {
          const topic = String(args.topic);
          const added = pushTopic(
            userId, mainSessionId,
            topic, String(args.source), String(args.summary),
            String(args.persist) as "yes" | "ask" | "no",
            args.askMessageId as number | undefined
          );
          const topicTargetIds = [
            dialogue.userMessageId,
            dialogue.assistantMessageId,
          ].filter((id): id is string => Boolean(id));
          updateMessageTopicByMessageIds(
            mainSessionId,
            topicTargetIds,
            topic,
            path.join(DATA_ROOT, userId, "session", mainSessionId, "main")
          );
          compactionHints.topicWritten = true;
          return { added, topic: args.topic, persist: args.persist };
        }
        const result = await toolRegistry.execute(name, args, userId);
        if (DATA_MUTATION_TOOLS.has(name)) {
          compactionHints.dataMutated = true;
        }
        return result;
      },
    });

    updateLatestAssistantCompactionHintsSince(sessionId, startedAt, compactionHints, storageDir);
    const usage = latestAssistantUsageSince(sessionId, startedAt, storageDir);
    if (usage) {
      maybeCompactContext({
        sessionId,
        actor: "topic-agent",
        usage,
        baseDir: storageDir,
      });
    }
  } catch (err) {
    logger.debug("Topic Agent 失败", { error: String(err) });
  }
}

const DATA_MUTATION_TOOLS = new Set([
  "add_entry",
  "update_entry",
  "delete_entry",
  "create_folder",
  "update_folder",
  "delete_folder",
  "delete_file",
]);
