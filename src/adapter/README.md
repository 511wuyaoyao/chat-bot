# adapter

外部应用适配层目录。这里负责把 NapCat、AkashaWeChat 等具体应用实现成标准外部协议接口。

## 职责

- 保存外部标准协议定义，例如 OneBot11。
- 保存具体应用到标准协议的实现，例如 `napcat-to-onebot`。
- 不保存项目内部消息协议，不处理平台业务策略。

## 子目录

- `input.ts`：adapter 目录允许依赖和接收的上游边界。
- `output.ts`：adapter 目录允许向外暴露的公开边界。
- `protocol/`：外部标准协议定义。
- `implementations/`：具体应用到标准协议的运行实现。
