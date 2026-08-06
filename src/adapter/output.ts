/**
 * adapter 目录允许向外暴露的公开边界。
 */

export * from "./protocol/onebot11";
export { createOneBot11Adapter } from "./implementations/napcat-to-onebot";
export { createQQBotToOneBot11Adapter } from "./implementations/qqbot-to-onebot";
