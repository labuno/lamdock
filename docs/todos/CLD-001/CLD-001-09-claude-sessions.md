# CLD-001-09: Claude 会话索引与删除

- **Todo ID**: CLD-001-09
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

LAM 能扫描每个 Claude 空间的 `projects/**/*.jsonl`，解析会话 id、工作目录、摘要与模型，提供分页查询与删除（含暂存与用量清理），并清理 Claude 用量库中的对应行。

## Contract

- **Requirements**: `REQ-SCP-05`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-07`, `REQ-IF-16`, `REQ-IF-19`, `REQ-WP-E`, `REQ-TM-01`, `REQ-TM-03`, `REQ-TM-04`, `REQ-VER-01`, `REQ-EXT-01`
- **Produces**: `artifact:claude-session-index` — 会话索引、分页查询与暂存删除。
- **Gates**: `cargo test --test claude_sessions`；`make check`。
- **Boundaries**: 只读解析，不改写会话文件内容；删除必须先暂存后清理；解析失败的文件跳过并计入诊断，不阻塞其它会话。

## Tasks

- [ ] `T01` 实现会话索引与解析。
  - **Test and RED**: 在 `tests/claude_sessions.rs` 构造 `projects/-Users-me-proj/<uuid>.jsonl` 与损坏 JSONL，断言正确解析 UUID、cwd、摘要、模型与时间戳，损坏文件被跳过且不出现在结果中。实现前 RED。
  - **Execution logic**: 扫描 `projects/*/*.jsonl`，会话 id 取文件 stem 并以 UUID 校验；cwd 与摘要从首个含该字段的记录读取，读取限制在文件前 N 行以避免大文件开销；模型取最后一条 assistant 记录；索引结果复用 Claude 账号缓存模式（内存缓存 + 按需刷新）。
  - **Files and responsibilities**: `src/services/claude_sessions.rs` 拥有扫描与解析；`tests/claude_sessions.rs` 拥有解析用例。
  - **Verification**: 正常（多空间扫描）、边界（空目录、无 cwd、超长摘要截断）、非法（非 UUID 文件名跳过）、错误（权限错误返回结构化错误）。
  - **Artifact handoff**: 索引能力供 T02/T03 与 CLD-001-10/13 消费。
- [ ] `T02` 实现分页查询、排序与过滤命令。
  - **Test and RED**: 断言分页游标稳定（相同输入返回相同分页）、按时间/大小排序正确、按空间过滤正确；非法游标返回结构化错误。实现前 RED。
  - **Execution logic**: 复用 Codex 会话查询的游标结构（modified_at + size + path 三段排序键），命令层做参数校验，服务层排序与截断；查询只返回元数据，不返回消息内容。
  - **Files and responsibilities**: `src/services/claude_sessions.rs` 拥有查询；`src/commands/mod.rs` 注册命令；`tests/claude_sessions.rs` 拥有分页用例。
  - **Verification**: 正常（分页）、边界（空结果、最后一页）、非法（负数 limit、非法游标）、状态（查询期间新增文件不影响游标稳定性）。
  - **Artifact handoff**: 命令面供 CLD-001-13 会话视图消费。
- [ ] `T03` 实现暂存删除与用量清理联动。
  - **Test and RED**: 断言删除后原文件消失、暂存目录为空、Claude 用量库对应行被清除、Codex 用量库与缓存不受影响；注入清理失败断言暂存保留原文件供恢复。实现前 RED。
  - **Execution logic**: 顺序为「移动到 `~/.lam/session-delete-staging/` → 删除用量行 → 清理暂存」；任一步失败保留暂存并返回结构化错误；删除前校验路径位于目标空间内以防越界；批量删除逐条处理并汇总结果。
  - **Files and responsibilities**: `src/services/claude_sessions.rs` 拥有删除；`src/services/claude_usage.rs` 提供删除钩子接口（CLD-001-11 实现）；`tests/claude_sessions.rs` 拥有删除用例。
  - **Verification**: 正常（删除）、回滚（清理失败恢复）、非法（越界路径）、状态（并发删除同一会话只成功一次）、边界（空会话文件）。
  - **Artifact handoff**: 删除能力供 CLD-001-13 UI 与 CLD-001-14 验收。

## Tests

- `tests/claude_sessions.rs`：索引解析、损坏文件跳过、分页游标、排序过滤、暂存删除、越界拒绝。
- **RED**: 索引/解析/删除函数缺失或游标不稳定时的失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 会话文件格式与实测冲突导致无法可靠取到 cwd/摘要时停止并更新设计。
- 删除需要修改会话文件内容时停止（违反只读解析边界）。
- 用量清理接口在 CLD-001-11 未完成前，删除必须以「暂存保留 + 明确错误码」处理而不是静默跳过。
