/**
 * 用户可见消息集中管理
 * 所有可能出现在对话中的文案都在这里，按模块拆分
 */

// ====== 重导出 ======

export * from "./tools";
export * from "./messages";
export * from "./attention";
export * from "./main-agent";
export * from "./exec-agent";
export * from "./topic-agent";

// ====== Agent Loop 内部消息 ======

export const AGENT_FORCE_REPLY =
  "你已经执行了足够的操作。现在请根据工具返回的结果，用自然的中文给用户一个总结性的回复。不要再调用工具。";

export const AGENT_PLEASE_REPLY = "请根据你的判断回复用户，不要沉默。";

// ====== 兜底回复 ======

export const FALLBACK_API_ERROR = "出错了，稍后重试";

export const FALLBACK_EMPTY_REPLY = "还有什么可以帮你的？";

export const FALLBACK_ALL_DONE = "处理完了，还有什么需要吗？";

export const FALLBACK_CANNOT_RESPOND = "出了点问题，换个说法试试";

export const QA_FALLBACK_PROMPT =
  "你是用户的个人助理。当前消息处理出现了技术问题。" +
  "请简短回复用户（不超过 100 字），如实告知暂时无法处理，建议稍后重试。" +
  "保持一贯风格：纯文本，不用 markdown，不用 emoji，不用俏皮语气词。";
