# CLD-001-02: 多 agent 存储布局与 Codex 零回归基线

- **Todo ID**: CLD-001-02
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

`~/.lam` 拥有按 agent 分区的 Claude 存储路径（账号缓存、notes、认证元数据、Claude 用量库、投影记录）与统一 marker 读写；Codex 现有文件路径、权限与内容保持字节兼容，并通过兼容性 Gate。

## Contract

- **Requirements**: `REQ-OBJ-03`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-03`, `REQ-IF-05`, `REQ-WP-A`, `REQ-TM-01`, `REQ-VER-01`, `REQ-VER-05`, `REQ-DONE-05`, `REQ-STOP-02`, `REQ-EXT-04`
- **Produces**: `artifact:multi-agent-store` — 按 agent 分区的路径 API、Claude 账号缓存/notes 与 marker 读写，Codex 存储零变化。
- **Gates**: `cargo test --test agent_store_migration`；`make check`。
- **Boundaries**: 不迁移、不改写任何既有 Codex 文件；新增文件首次写入时创建；目录权限 0700、文件权限 0600。

## Tasks

- [ ] `T01` 扩展 `LamPaths` 提供 Claude 存储路径。
  - **Test and RED**: 在 `tests/agent_store_migration.rs` 断言新增路径函数返回 `~/.lam/config/claude-accounts-cache.json`、`~/.lam/config/claude-account-notes.json`、`~/.lam/config/claude-auth-metadata/`、`~/.lam/usage/claude-usage.sqlite3`、`~/.lam/provider-hub/claude-projections.json`，且 `LamPaths` 旧函数返回值不变。函数缺失时编译失败为 RED。
  - **Execution logic**: 在 `services/lam_paths.rs` 增加方法，沿用 `LAM_HOME` 覆盖语义；所有路径由 `root` 派生，禁止拼接裸 `$HOME`；新增目录在首次写入时以 0700 创建。
  - **Files and responsibilities**: `src/services/lam_paths.rs` 拥有路径；`tests/agent_store_migration.rs` 拥有路径断言。
  - **Verification**: 正常（默认与 `LAM_HOME` 覆盖）、边界（root 不存在时不 panic）、安全（目录权限 0700）。
  - **Artifact handoff**: 为 CLD-001-03/04/05/11 提供稳定路径，后续节点不得自行拼接路径。
- [ ] `T02` 实现 Claude 账号缓存与 notes 分区读写。
  - **Test and RED**: 断言写入 Claude 缓存后 `claude-accounts-cache.json` 内容为 camelCase 且 `accounts-cache.json`（Codex）字节不变；读回 notes 与 Codex notes 互不影响。实现前失败为 RED。
  - **Execution logic**: 复用 Codex 的缓存读写模式（原子写 + 0600），但使用独立文件与独立结构；读取失败返回空缓存而不是错误；写入顺序为先写临时文件再 rename。
  - **Files and responsibilities**: `src/services/agent_store.rs` 拥有分区读写；`tests/agent_store_migration.rs` 拥有隔离测试。
  - **Verification**: 正常（读写往返）、非法（损坏 JSON 返回空缓存并保留原文件）、状态（并发写不产生半文件）、安全（文件权限 0600）。
  - **Artifact handoff**: `artifact:multi-agent-store` 提供账号缓存能力，供 CLD-001-03 的列表读取消费。
- [ ] `T03` 实现统一 marker 读写与 Codex 零回归兼容 Gate。
  - **Test and RED**: 断言 marker `.managed-by-lam.json` 可写可读且字段为 `agentId`/`profileId`/`homePath`/`wrapperPath`/`createdAt`；同时运行既有 Codex 账号测试断言 `list_accounts` 与 `CodexAccount` 投影零变化。实现前 RED。
  - **Execution logic**: marker 写入使用 0600 与原子替换；读取对未知字段宽容、缺失 `agentId` 时按目录名推导为 `codex` 以兼容历史 marker；测试显式覆盖旧 marker 场景。
  - **Files and responsibilities**: `src/services/agent_store.rs` 拥有 marker；`tests/agent_store_migration.rs` 拥有兼容用例。
  - **Verification**: 正常（读写）、边界（旧 marker 无 agentId）、错误（不可写目录返回结构化错误）、安全（不覆盖非 LAM marker）。
  - **Artifact handoff**: 为 CLD-001-03 的创建/删除流程提供 marker 语义，为 CLD-001-14 提供兼容性证据。

## Tests

- `tests/agent_store_migration.rs`：路径断言、缓存隔离、marker 往返、旧 marker 兼容、损坏 JSON。
- 既有 `cargo test` Codex 套件：缓存与 DTO 零变化。
- **RED**: 路径与分区读写不存在时的编译失败与断言失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 任何 Codex 文件需要被移动、重命名或改写时停止。
- 发现既有代码已写入非 LAM 所有的共享路径时停止并回到设计评审。
