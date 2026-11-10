# CLD-001-05: Provider 协议扩展与 Claude settings.json 托管投影

- **Todo ID**: CLD-001-05
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

Provider Hub 支持 `anthropic_messages` 协议；LAM 能把上游配置以受管投影写入目标空间 `settings.json` 的 `env` 键（含模型映射与小模型兜底），并在 detach 时逐键校验后还原；`settings.json` 不出现明文密钥。

## Contract

- **Requirements**: `REQ-OBJ-04`, `REQ-SCP-03`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-05`, `REQ-IF-08`, `REQ-IF-09`, `REQ-IF-10`, `REQ-IF-11`, `REQ-WP-C`, `REQ-TM-01`, `REQ-TM-02`, `REQ-TM-03`, `REQ-VER-01`, `REQ-STOP-02`, `REQ-STOP-03`, `REQ-STOP-04`, `REQ-EXT-01`, `REQ-EXT-04`, `REQ-OBJ-05`, `REQ-IF-40`, `REQ-TM-07`, `REQ-TM-08`
- **Produces**: `artifact:claude-settings-projection` — 协议扩展、JSON 受管投影器与密钥引用。
- **Gates**: `cargo test --test claude_projection`；`make check`。
- **Boundaries**: `responses` 与 `chat_completions` 序列化不变；投影失败必须还原；未使用的受管键移除而不是写空；默认空间与受管空间使用同一套受管语义与备份策略。

## Tasks

- [ ] `T01` 扩展 `ProviderProtocol` 与 DTO 支持 `anthropic_messages`。
  - **Test and RED**: 在 `tests/claude_projection.rs` 断言新增协议可往返序列化、既有协议序列化快照不变、Claude 目标协议组合（`anthropic_messages`/`chat_completions`）合法而（`responses` 直连到 Claude）被拒绝。实现前 RED。
  - **Execution logic**: 在 `provider_v2.rs` 增加枚举分支；`provider_api_v2.rs` 的 DTO 与视图增加字段并保持旧字段兼容；协议校验集中在一处，供 planner 复用；迁移函数保持未知协议安全拒绝。
  - **Files and responsibilities**: `src/services/provider_v2.rs` 拥有协议枚举；`src/services/provider_api_v2.rs` 拥有 DTO；`tests/claude_projection.rs` 拥有序列化兼容测试。
  - **Verification**: 正常（新协议往返）、边界（未知协议拒绝）、兼容（旧快照不变）。
  - **Artifact handoff**: 为 CLD-001-06 的计划器与 CLD-001-12 的编辑器提供协议类型。
- [ ] `T02` 实现 `settings.json` 受管投影器（apply/detach/drift/备份）。
  - **Test and RED**: 断言首次 apply 生成 `env` 键并记录 `beforeHash`/`appliedHash`/`previousValues`/`managedValues`；外部修改其中一个受管键后 detach 返回 `OWNERSHIP_CONFLICT` 且不改文件；未修改时 detach 完整还原（含删除本次新增键）。实现前 RED。
  - **Execution logic**: 读取原文件（不存在视为空对象）、校验 JSON 合法、逐键写入并保留非受管键与未知字段、原子替换并保留备份；detach 先逐键比对所有权，再还原 `previousValues` 或删除；提交前先校验解析结果，失败则保持原文件。
  - **Files and responsibilities**: `src/services/claude_config_editor.rs` 拥有 JSON 投影；`src/services/agent_store.rs` 拥有投影记录存储；`tests/claude_projection.rs` 拥有投影用例。
  - **Verification**: 正常（apply/detach）、状态（drift 冲突）、回滚（写失败保持原文件）、边界（空文件、含注释失败、只读文件）、安全（备份文件 0600）。
  - **Artifact handoff**: `artifact:claude-settings-projection` 的核心能力，供 CLD-001-06 编排与 CLD-001-08 绑定复用。
- [ ] `T03` 实现模型映射与小模型兜底校验。
  - **Test and RED**: 断言模型选择为空或缺少小模型映射时计划返回阻断器 `model_mapping_required`；选择合法模型后投影同时写入 `ANTHROPIC_MODEL` 与 `ANTHROPIC_DEFAULT_HAIKU_MODEL`。实现前 RED。
  - **Execution logic**: 从 provider 模型列表选择默认模型与 haiku 等价模型（显式选择优先，缺省选择第一个标记为小模型的项）；若上游没有小模型则要求用户显式指定，否则阻断；投影移除未使用的 `ANTHROPIC_DEFAULT_SONNET_MODEL`/`OPUS`。
  - **Files and responsibilities**: `src/services/claude_projection_plan.rs` 拥有校验与阻断器；`tests/claude_projection.rs` 拥有模型映射用例。
  - **Verification**: 正常（写入两键）、边界（仅一个模型）、非法（空模型列表）、状态（模型变更后重新投影移除旧键）。
  - **Artifact handoff**: 供 CLD-001-06 计划视图与 CLD-001-12 模型选择器消费。
- [ ] `T04` 密钥引用与无明文校验。
  - **Test and RED**: 断言投影结果不包含明文 token（以测试哨兵字符串扫描整个 `settings.json`）、wrapper 通过 `lam-auth-helper` 注入、helper 参数包含状态根、profile 与凭据引用。实现前 RED。
  - **Execution logic**: 生成 Keychain 凭据引用（复用 `provider_keychain` 服务），投影只写引用所需的环境标记；wrapper 启动时调用 `lam-auth-helper` 解析 token 注入 `ANTHROPIC_AUTH_TOKEN`；helper 失败时 wrapper 以非零码退出并输出可操作错误。
  - **Files and responsibilities**: `src/services/claude_projection_auth.rs` 拥有密钥引用；`src/bin/lam-auth-helper.rs` 增加 Claude 分支；`tests/claude_projection.rs` 拥有无明文用例。
  - **Verification**: 安全（哨兵扫描、keychain 引用形态）、错误（helper 失败）、边界（无 token 的账号类型）。
  - **Artifact handoff**: 为 CLD-001-06/08 提供统一的密钥注入方式。

## Tests

- `tests/claude_projection.rs`：协议往返、投影 apply/detach、drift、模型映射阻断、无明文扫描。
- **RED**: 协议不存在、投影器缺失、明文密钥出现时的失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- `settings.json` schema 与官方文档/实测冲突时停止并回到设计评审。
- 需要把明文密钥写入配置文件才能工作时停止（违反密钥合同）。
- 既有 Provider 序列化必须变更才能支持新协议时停止并走正式设计变更。
