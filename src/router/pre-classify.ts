/**
 * 规则预分类
 * 在调用 AI 之前先用正则匹配，命中则作为 hint 注入 NL 解析的 prompt
 */
export interface PreClassifyHint {
  intent: string;
  scene?: string;
}

const RULES: { pattern: RegExp; intent: string; scene?: string }[] = [
  { pattern: /帮我记|添加|收藏|记录|记一下|帮我存/, intent: "create" },
  { pattern: /有什么|查一下|列出|找一下|哪些|搜索|我.*的.*有/, intent: "query" },
  { pattern: /看完了|完成了|做完了|吃完了|买完了|读完了|打完了/, intent: "update" },
  { pattern: /删掉|删除|去掉|移除/, intent: "delete" },
  { pattern: /无聊|没意思|不知道干嘛|不知道看什么|好闲/, intent: "recommend", scene: "boredom" },
  { pattern: /吃啥|吃什么|饿了|想吃|推荐.*吃/, intent: "recommend", scene: "hungry" },
  { pattern: /想学|学点|学习|推荐.*学|学什么/, intent: "recommend", scene: "learn" },
];

export function preClassify(text: string): PreClassifyHint | null {
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      return { intent: rule.intent, scene: rule.scene };
    }
  }
  return null;
}
