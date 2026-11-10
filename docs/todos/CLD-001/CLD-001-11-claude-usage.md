# CLD-001-11: Claude 用量与额度采集

- **Todo ID**: CLD-001-11
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

Claude 会话的 token 活动写入独立数据库 `~/.lam/usage/claude-usage.sqlite3` 并提供查询服务；订阅额度（可选开启）以 `UsageQuotaSnapshot` 形状输出，失败时明确降级；Codex 用量库不受任何影响。

## Contract

- **Requirements**: `REQ-SCP-06`, `REQ-SCP-10`, `REQ-STP-01`, `REQ-STP-02`, `REQ-IF-19`, `REQ-IF-20`, `REQ-IF-21`, `REQ-IF-22`, `REQ-WP-F`, `REQ-TM-01`, `REQ-TM-04`, `REQ-TM-05`, `REQ-VER-01`, `REQ-DONE-04`, `REQ-EXT-03`, `REQ-EXT-05`, `REQ-IF-35`, `REQ-IF-36`
- **Produces**: `artifact:claude-usage-readmodel` — 独立用量库、查询服务与额度快照。
- **Gates**: `cargo test --test claude_usage_quota`；`make check`。
- **Boundaries**: 不写 Codex 用量库；不把估算伪装成实时额度；凭据只读且不落日志；刷新幂等。

## Tasks

- [ ] `T01` 建立独立用量库与增量刷新。
  - **Test and RED**: 在 `tests/claude_usage_quota.rs` 以固定 JSONL fixture 断言首次刷新写入预期 calls/threads 行、第二次刷新幂等不重复、追加新记录后只新增增量行；断言 Codex `usage.sqlite3` mtime/内容不变。实现前 RED。
  - **Execution logic**: 建库 schema（calls：会话 id、消息 id、模型、输入/输出/缓存 token、时间戳；threads：会话 id、cwd、标题、最后活动时间）；按 (session, message) 唯一键 upsert 保证幂等；解析 assistant 记录的 usage 字段，缺失字段记 0 而不是丢弃行；刷新按文件 mtime+size 跳过未变文件。
  - **Files and responsibilities**: `src/services/claude_usage.rs` 拥有 schema 与刷新；`tests/claude_usage_quota.rs` 拥有刷新用例。
  - **Verification**: 正常（刷新与增量）、边界（空文件、无 usage 记录）、错误（损坏 JSONL 跳过并计数）、安全（数据目录权限）、并发（刷新重入锁）。
  - **Artifact handoff**: 用量库供 T02 查询与 CLD-001-13 UI 消费。
- [ ] `T02` 实现用量查询服务与删除联动。
  - **Test and RED**: 断言 summary/dashboard 查询返回预期聚合（按日、按模型、按空间），删除会话后对应 calls/threads 行被清除；查询空库返回零值而不是错误。实现前 RED。
  - **Execution logic**: 聚合查询以 SQL 完成，不加载全部行到内存；删除接口供 CLD-001-09 调用，删除前先确认会话归属；所有查询只读，写入只发生在刷新。
  - **Files and responsibilities**: `src/services/claude_usage.rs` 拥有查询与删除；`src/commands/mod.rs` 注册命令；`tests/claude_usage_quota.rs` 拥有查询与删除用例。
  - **Verification**: 正常（聚合正确）、边界（空库、跨日边界）、状态（删除后重扫不复活）、非法（越界路径删除被拒）。
  - **Artifact handoff**: 查询命令供 CLD-001-13 展示与 CLD-001-14 验收。
- [ ] `T03` 实现额度快照采集与降级策略。
  - **Test and RED**: 以 wiremock 模拟 OAuth usage 接口，断言开启开关后返回 5 小时/7 天窗口的 `UsageQuotaSnapshot`；接口 401/500 时返回 `source=unavailable` 并保留最后成功快照为 `stale_cache`；API Key 账号返回 `unavailable` 且零 HTTP 调用。实现前 RED。
  - **Execution logic**: 开关默认关闭并持久化在 LAM 设置；采集前读取凭据（Keychain 优先），token 只用于请求头且不落日志；解析窗口字段映射到既有 `UsageQuotaSnapshot` 的窗口结构；失败时记录 `fetched_at` 与原因；缓存写入沿用现有 quota-cache 目录下的 Claude 分区。
  - **Files and responsibilities**: `src/services/claude_quota.rs` 拥有采集；`src/services/types.rs` 增加设置项；`tests/claude_usage_quota.rs` 拥有额度用例。
  - **Verification**: 正常（窗口解析）、错误（401/500/超时）、边界（重置时间跨时区）、安全（令牌不落日志、请求仅 https）、状态（开关关闭时零请求）。
  - **Artifact handoff**: 快照数据供 CLD-001-13 托盘与界面展示。
- [ ] `T04` 提供并发刷新与缓存读取命令。
  - **Test and RED**: 断言并发刷新只执行一次（第二次返回进行中状态）、读取命令返回缓存且带 `fetched_at`；冷启动无缓存时返回 `unavailable` 而不是空错误。实现前 RED。
  - **Execution logic**: 复用 Codex 配额刷新的并发控制模式（互斥 + 进行中标记），读取命令只读缓存；刷新失败不覆盖可用缓存的内容，只更新状态字段。
  - **Files and responsibilities**: `src/services/claude_quota.rs` 拥有刷新控制；`tests/claude_usage_quota.rs` 拥有并发用例。
  - **Verification**: 正常（并发合并）、状态（失败不破坏缓存）、边界（无缓存冷启动）。
  - **Artifact handoff**: 命令面供 CLD-001-13 与 CLD-001-14 消费。

## Tests

- `tests/claude_usage_quota.rs`：增量与幂等刷新、聚合查询、删除联动、额度解析、失败降级、并发刷新。
- **RED**: 库/查询/额度函数缺失或写入 Codex 库时的失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 额度接口形态与参考实现/实测冲突且无法稳定解析时停止并保持功能默认关闭。
- 需要默认开启额度采集时停止（必须是显式 opt-in）。
- 任何写入 Codex 用量库的需求出现时停止并回到设计。
