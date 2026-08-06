/**
 * platform 目录允许依赖和接收的上游边界。
 */

import { config } from "../config/output";
import { messages } from "../prompt";
import { logger } from "../utils/logger";

import type { OneBot11IncomingEvent, OneBot11Runtime, OneBotGetMsgData } from "../adapter/output";
import { createOneBot11Adapter } from "../adapter/output";

