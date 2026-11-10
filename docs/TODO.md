# LamDock 当前任务

历史实施流水、已完成 TODO 和退役功能任务已清理。本页只提供现行任务入口，
各任务的状态与证据以对应计划/执行图为准。

- 大模块拆分：依次拆分 `provider_api_v2.rs`（迁移恢复／Provider／API 帐号／绑定）、
  `routes/views.tsx`（按页面）、`App.tsx`（按交互）和 `styles.css`（按组件）。每次只迁移一个职责，
  不改变公开导出、序列化和业务行为，每步运行对应测试和 `make check`。
- [当前手工验收](manual-acceptance.md)：保留真实帐号、ChatGPT 重启、Antigravity 和代理出口等未关闭场景。
- [Claude／多 Agent 适配](CLD-001-claude-agent-support-plan.md) 与 [执行任务](todos/CLD-001/README.md)。
- 其他未关闭专题任务见 [文档入口](README.md)。

整帐号 Sync 和本地 Usage/activity estimate 已退役，不恢复为待实现功能。
