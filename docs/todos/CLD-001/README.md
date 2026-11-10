# CLD-001 执行导航

- **源计划**: [`docs/CLD-001-claude-agent-support-plan.md`](../../CLD-001-claude-agent-support-plan.md)
- **状态与依赖唯一事实源**: [`execution-map.json`](execution-map.json)
- **语义追溯唯一事实源**: [`traceability.json`](traceability.json)

## 校验

```bash
python3 ~/.agents/skills/tdd-workflow/scripts/validate_todo_graph.py docs/todos/CLD-001/execution-map.json
```

## 节点导航

| 波次 | 节点 | Todo |
|---|---|---|
| A 基础 | CLD-001-01 / 02 | [01](CLD-001-01-agent-model.md) · [02](CLD-001-02-agent-store.md) |
| B 空间与认证 | CLD-001-03 / 04 | [03](CLD-001-03-claude-spaces.md) · [04](CLD-001-04-claude-auth.md) |
| C 直连 | CLD-001-05 / 06 | [05](CLD-001-05-claude-projection.md) · [06](CLD-001-06-claude-api-account.md) |
| D 网关 | CLD-001-07 / 08 | [07](CLD-001-07-claude-gateway.md) · [08](CLD-001-08-claude-gateway-binding.md) |
| E 会话 | CLD-001-09 / 10 | [09](CLD-001-09-claude-sessions.md) · [10](CLD-001-10-claude-handoff.md) |
| F 用量 | CLD-001-11 | [11](CLD-001-11-claude-usage.md) |
| G 交付 | CLD-001-12 / 13 / 14 | [12](CLD-001-12-claude-accounts-ui.md) · [13](CLD-001-13-claude-sessions-usage-ui.md) · [14](CLD-001-14-contracts-release.md) |

本文件只做导航：状态、就绪度、依赖、Artifact 与 Gate 证据一律以 `execution-map.json` 为准。
