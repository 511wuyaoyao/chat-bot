/**
 * OneBot v11 事件类型出口。
 */

import type { OneBotMessageEvent, OneBotSelfMessageEvent } from "./message";
import type { OneBotNoticeEvent } from "./notice";
import type { OneBotRequestEvent } from "./request";
import type { OneBotMetaEvent } from "./meta";

export * from "./message";
export * from "./notice";
export * from "./request";
export * from "./meta";

export type OneBotEvent =
  | OneBotMessageEvent
  | OneBotSelfMessageEvent
  | OneBotNoticeEvent
  | OneBotRequestEvent
  | OneBotMetaEvent;

