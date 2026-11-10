# CLD-001-01: Agent 领域模型与注册表

- **Todo ID**: CLD-001-01
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

LAM 获得与 agent 无关的领域模型：`AgentId`、`AgentProfile`、`AgentCapabilities` 与 `AgentRegistry` 分派门面；Codex 通过适配器接入且输出与既有 `CodexAccount` 完全一致，前端 `types.ts` 获得镜像类型。

## Contract

- **Requirements**: `REQ-OBJ-01`, `REQ-OBJ-03`, `REQ-SCP-12`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-03`, `REQ-IF-01`, `REQ-IF-02`, `REQ-WP-A`, `REQ-TM-01`, `REQ-VER-01`, `REQ-STOP-01`, `REQ-EXT-04`, `REQ-IF-34`, `REQ-IF-39`
- **Produces**: `artifact:agent-model` — 可被上层按 agent 分派的类型与注册表，Codex 适配器输出与现状逐字段一致。
- **Gates**: `cargo test --test agent_model`；`make check`。
- **Boundaries**: 本节点只做类型、投影与分派，不新增任何 Claude 行为；`CodexAccount` 的字段名、序列化与缓存文件保持不变；`AgentId` 不接受未知取值。

## Tasks

- [ ] `T01` 定义 `AgentId`、`AgentProfile`、`AgentCapabilities` 与序列化契约。
  - **Test and RED**: 新增 `apps/desktop/src-tauri/tests/agent_model.rs`，断言 `AgentId` 仅接受 `codex`/`claude_code`、未知值反序列化失败、`AgentProfile` 序列化为 camelCase 且字段集合与前端 `spec.ts` 镜像一致。运行 `cargo test --test agent_model`，在类型不存在时编译失败即预期 RED。
  - **Execution logic**: 在 `services/agent.rs` 定义枚举与结构体，`#[serde(rename_all = "snake_case")]` 用于 `AgentId`、camelCase 用于 DTO；`AgentCapabilities` 以布尔字段声明 `scanProfiles`、`wrapperGeneration`、`terminalLogin`、`externalApi`、`sessions`、`quota`；未知 agent 反序列化返回结构化错误而非默认值。
  - **Files and responsibilities**: `src/services/agent.rs` 拥有类型与序列化；`src/services/mod.rs` 导出模块；`tests/agent_model.rs` 拥有契约测试。
  - **Verification**: 正常（两个合法取值往返）、非法（未知字符串、空字符串）、边界（大小写与连字符变体必须拒绝）；安全维度不适用，因为不含 IO 与凭据。
  - **Artifact handoff**: 提供 `artifact:agent-model` 的基础类型；节点 CLD-001-02 起所有 agent 分派都消费该类型。
- [ ] `T02` 实现 `AgentRegistry` 分派门面与 Codex 适配器。
  - **Test and RED**: 在同一测试文件新增用例：`list_profiles` 对 Codex 返回的每个 `AgentProfile` 与 `list_accounts` 的 `CodexAccount` 逐字段投影一致；未知 agent 返回 `AGENT_UNSUPPORTED`。先写断言再实现，未实现时编译失败为 RED。
  - **Execution logic**: `AgentRegistry` 持有序 backend 列表，按 `AgentId` 查找；Codex backend 复用 `services::account` 现有函数；`find_profile`、`wrapper_script`、`login_command` 一律经注册表，禁止上层匹配目录名；未注册 agent 返回结构化错误码。
  - **Files and responsibilities**: `src/services/agent_registry.rs` 拥有注册与分派；`src/services/agent_backend_codex.rs` 拥有 Codex 适配器；`tests/agent_model.rs` 拥有分派一致性测试。
  - **Verification**: 正常（Codex 投影一致）、边界（空 home）、状态（重复注册同一 agent 必须报错）、安全（不读取 `auth.json` 内容，只读取存在性）。
  - **Artifact handoff**: `artifact:agent-model` 获得分派能力；CLD-001-03 通过注册表注册 Claude backend。
- [ ] `T03` 前端镜像类型与命令契约占位。
  - **Test and RED**: 在 `apps/desktop/src/lib/types.ts` 增加 `AgentId`/`AgentProfile`/`AgentCapabilities` 后，新增 `src/lib/agent-types.test.ts` 以固定 camelCase 字段快照；运行 `npm run test:ui -- agent-types`，缺失类型时失败为 RED。
  - **Execution logic**: 前端类型与 Rust serde 输出逐字段对齐，只增加类型不增加 UI；同时导出 `AGENT_LABELS` 供后续视图复用；不在本节点新增 Tauri 命令。
  - **Files and responsibilities**: `src/lib/types.ts` 拥有类型；`src/lib/agent-types.test.ts` 拥有快照测试。
  - **Verification**: 正常（快照匹配）、边界（未知 agent 值在类型层面被拒绝）；其余维度不适用，因为本任务不引入运行时行为。
  - **Artifact handoff**: 供 CLD-001-12/13 的视图类型使用；字段命名冻结后不允许在 UI 节点私自改名。

## Tests

- `tests/agent_model.rs`：合法/非法 `AgentId`、camelCase 快照、Codex 投影逐字段一致、未注册 agent 错误。
- `src/lib/agent-types.test.ts`：前端类型快照。
- **RED**: 类型与注册表不存在时的编译失败与快照缺失。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- `CodexAccount` 需要改字段或序列化才能完成投影时停止并回到设计。
- 出现未在源计划中的第二个 agent 需求时停止并更新源计划。
- 前端类型需要展示凭据内容时停止（违反零泄漏原则）。
