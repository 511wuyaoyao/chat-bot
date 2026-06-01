/**
 * 工具注册表
 * 集中管理所有工具的定义（JSON Schema）和实现（handler 函数）
 * Agent Loop 通过它获取工具列表并执行工具调用
 */

/**
 * 工具的 JSON Schema 定义（OpenAI function calling 格式）
 */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

/**
 * 工具处理器：定义 + 使用指南 + 执行函数
 */
export interface ToolHandler {
  definition: ToolDefinition;
  /** 补充到 system prompt 中的使用指南（分类规则、状态映射等领域知识） */
  usageGuide?: string;
  /** 执行工具，返回结果对象（会被 JSON.stringify 后传给 AI） */
  execute(args: Record<string, unknown>, userId: string): Promise<unknown>;
}

class ToolRegistry {
  private tools = new Map<string, ToolHandler>();

  /** 注册工具 */
  register(handler: ToolHandler): void {
    const name = handler.definition.function.name;
    if (this.tools.has(name)) {
      throw new Error(`工具 "${name}" 已注册，不能重复注册`);
    }
    this.tools.set(name, handler);
  }

  /** 获取所有工具定义（传给 DeepSeek API 的 tools 参数） */
  getDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  /** 执行指定工具 */
  async execute(name: string, args: Record<string, unknown>, userId: string): Promise<unknown> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`未知工具: ${name}`);
    }
    return tool.execute(args, userId);
  }

  /** 获取所有工具的使用指南（过滤掉没有 usageGuide 的） */
  getUsageGuides(): string[] {
    const guides: string[] = [];
    for (const [, tool] of this.tools) {
      if (tool.usageGuide) {
        guides.push(tool.usageGuide);
      }
    }
    return guides;
  }

  /** 检查工具是否存在 */
  has(name: string): boolean {
    return this.tools.has(name);
  }
}

/** 全局单例 */
export const toolRegistry = new ToolRegistry();
