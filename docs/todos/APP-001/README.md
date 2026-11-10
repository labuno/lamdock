# APP-001 执行导航

- **源计划**: [`docs/APP-001-app-slot-shared-auth-plan.md`](../../APP-001-app-slot-shared-auth-plan.md)
- **状态与依赖唯一事实源**: [`execution-map.json`](execution-map.json)
- **语义追溯唯一事实源**: [`traceability.json`](traceability.json)

## 校验

```bash
python3 ~/.agents/skills/tdd-workflow/scripts/validate_todo_graph.py docs/todos/APP-001/execution-map.json
```

## 节点导航

| 顺序 | 节点 | 依赖 | Todo |
|---|---|---|---|
| 1 后端槽位 | APP-001-01 | — | [链接式切换与槽位凭据保全](APP-001-01-slot-link-switch.md) |
| 2 后端联动 | APP-001-02 | 01 | [当前帐号识别、删除与重命名联动](APP-001-02-account-lifecycle.md) |
| 2 前端入口 | APP-001-03 | 01 | [PAT 模式切换按钮可用性与文案](APP-001-03-pat-switch-ui.md) |
| 2 后端目标 | APP-001-05 | 01 | [App 当前目标查询与切换前置检查](APP-001-05-app-target-guard.md) |
| 3 前端目标 | APP-001-06 | 03、05 | [App 目标展示与连接切换](APP-001-06-app-target-ui.md) |
| 4 验收文档 | APP-001-04 | 02、06 | [全量检查、真实 App 验收与文档](APP-001-04-acceptance-docs.md) |

本文件只做导航：状态、就绪度、依赖、Artifact 与 Gate 证据一律以 `execution-map.json` 为准。
