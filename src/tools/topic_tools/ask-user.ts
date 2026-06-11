/**
 * ask_user 工具 — 向用户发送确认消息
 * 注册到全局工具目录，由 Topic Agent 选用执行
 * 实际发送由 Topic Agent 注入的 sendMessage 回调完成
 */

import { toolRegistry, ToolHandler } from "../../agent/tool-registry";

function askUserTool(): ToolHandler {
  return {
    definition: {
      type: "function",
      function: {
        name: "ask_user",
        description: "向用户发送确认消息询问是否记录。返回 message_id。仅在 persist=ask 时使用。",
        parameters: {
          type: "object",
          properties: {
            question: { type: "string", description: "询问内容" },
          },
          required: ["question"],
        },
      },
    },
    async execute(args: Record<string, unknown>) {
      // 实际发送由 Topic Agent 在执行时覆盖
      return { message_id: null, note: "ask_user 需在 Topic Agent 上下文中执行" };
    },
  };
}

toolRegistry.register(askUserTool());
