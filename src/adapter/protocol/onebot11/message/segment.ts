/**
 * OneBot v11 消息段类型定义。
 */

export type OneBotMessage = string | OneBotMessageSegment[];

export type OneBotMessageSegment =
  | OneBotTextSegment
  | OneBotFaceSegment
  | OneBotImageSegment
  | OneBotRecordSegment
  | OneBotVideoSegment
  | OneBotAtSegment
  | OneBotRpsSegment
  | OneBotDiceSegment
  | OneBotShakeSegment
  | OneBotPokeSegment
  | OneBotAnonymousSegment
  | OneBotShareSegment
  | OneBotContactSegment
  | OneBotLocationSegment
  | OneBotMusicSegment
  | OneBotReplySegment
  | OneBotForwardSegment
  | OneBotNodeSegment
  | OneBotXmlSegment
  | OneBotJsonSegment
  | OneBotUnknownSegment;

export interface OneBotBaseSegment<TType extends string, TData extends object> {
  type: TType;
  data: TData;
}

export type OneBotTextSegment = OneBotBaseSegment<"text", { text: string }>;
export type OneBotFaceSegment = OneBotBaseSegment<"face", { id: string | number }>;
export type OneBotImageSegment = OneBotBaseSegment<"image", OneBotMediaData>;
export type OneBotRecordSegment = OneBotBaseSegment<"record", OneBotMediaData & { magic?: boolean | string }>;
export type OneBotVideoSegment = OneBotBaseSegment<"video", OneBotMediaData>;
export type OneBotAtSegment = OneBotBaseSegment<"at", { qq: string | number }>;
export type OneBotRpsSegment = OneBotBaseSegment<"rps", Record<string, never>>;
export type OneBotDiceSegment = OneBotBaseSegment<"dice", Record<string, never>>;
export type OneBotShakeSegment = OneBotBaseSegment<"shake", Record<string, never>>;
export type OneBotPokeSegment = OneBotBaseSegment<"poke", { type: string | number; id: string | number; name?: string }>;
export type OneBotAnonymousSegment = OneBotBaseSegment<"anonymous", { ignore?: boolean | string }>;
export type OneBotShareSegment = OneBotBaseSegment<"share", { url: string; title: string; content?: string; image?: string }>;
export type OneBotContactSegment = OneBotBaseSegment<"contact", { type: "qq" | "group" | string; id: string | number }>;
export type OneBotLocationSegment = OneBotBaseSegment<"location", { lat: string | number; lon: string | number; title?: string; content?: string }>;
export type OneBotMusicSegment = OneBotBaseSegment<"music", OneBotMusicData>;
export type OneBotReplySegment = OneBotBaseSegment<"reply", { id: string | number }>;
export type OneBotForwardSegment = OneBotBaseSegment<"forward", { id: string }>;
export type OneBotXmlSegment = OneBotBaseSegment<"xml", { data: string }>;
export type OneBotJsonSegment = OneBotBaseSegment<"json", { data: string }>;

export type OneBotNodeSegment =
  | OneBotBaseSegment<"node", { id: string | number }>
  | OneBotBaseSegment<"node", {
      user_id: string | number;
      nickname: string;
      content: OneBotMessage;
    }>;

export interface OneBotMediaData {
  file: string;
  type?: string;
  url?: string;
  cache?: boolean | string | number;
  proxy?: boolean | string | number;
  timeout?: number | string;
}

export type OneBotMusicData =
  | { type: "qq" | "163" | "xm" | string; id: string | number }
  | { type: "custom"; url: string; audio: string; title: string; content?: string; image?: string };

export interface OneBotUnknownSegment {
  type: string;
  data?: Record<string, unknown>;
}
