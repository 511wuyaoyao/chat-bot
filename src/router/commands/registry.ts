/**
 * 指令注册表
 * 以 / 或空格开头触发指令匹配
 */

export interface CommandHandler {
  name: string;
  description: string;
  execute(userId: string, args: string[]): Promise<string>;
}

class CommandRegistry {
  private commands = new Map<string, CommandHandler>();

  register(handler: CommandHandler): void {
    if (this.commands.has(handler.name)) {
      throw new Error(`指令 "/${handler.name}" 已注册`);
    }
    this.commands.set(handler.name, handler);
  }

  match(input: string): { handler: CommandHandler; args: string[] } | null {
    // 必须以 / 或 # 开头
    if (input[0] !== "/" && input[0] !== "#") return null;

    // 跳过前缀，取第一个词作为指令名
    let i = 1;
    let name = "";
    while (i < input.length && input[i] !== " ") { name += input[i]; i++; }

    const handler = this.commands.get(name);
    if (!handler) return null;

    // 剩余部分作为参数
    const rest = input.slice(i).trim();
    const args = rest ? rest.split(/\s+/) : [];
    return { handler, args };
  }

  list(): CommandHandler[] {
    return Array.from(this.commands.values());
  }
}

export const commandRegistry = new CommandRegistry();
