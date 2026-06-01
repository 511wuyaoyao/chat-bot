# recommend 模块

推荐引擎 + 兴趣权重管理。

## 文件

- `engine.ts` — 推荐引擎：场景映射（boredom/hungry/learn → 文件夹）+ 打分排序（interest×0.6 + freshness×0.2 + variety×0.2）+ 去重
- `interest-manager.ts` — 兴趣权重：adjustInterest / applyDecay
- `recommend-record.ts` — 推荐历史记录，30 分钟去重窗口
