/**
 * config 目录允许依赖和接收的上游边界。
 */

import type dotenv from "dotenv";
import type fs from "fs";
import type path from "path";

export type ConfigInputDependencies = {
  dotenv?: typeof dotenv;
  fs?: typeof fs;
  path?: typeof path;
};
