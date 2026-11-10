# CLD-001-06: Claude API 账号编排（直连）

- **Todo ID**: CLD-001-06
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

用户可以像创建 Codex external API 账号一样，为 Claude 空间规划并执行 API 账号绑定（直连 Anthropic Messages 上游），支持分离与凭据轮换，失败自动回滚；命令注册进 Tauri 并可在前端调用。

## Contract

- **Requirements**: `REQ-SCP-03`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-05`, `REQ-IF-09`, `REQ-IF-10`, `REQ-IF-11`, `REQ-WP-C`, `REQ-TM-01`, `REQ-TM-03`, `REQ-VER-01`, `REQ-DONE-02`, `REQ-STOP-03`, `REQ-OBJ-05`, `REQ-IF-43`, `REQ-TM-06`, `REQ-TM-08`
- **Produces**: `artifact:claude-api-account` — plan/execute/detach/rotate 编排与 Tauri 命令。
- **Gates**: `cargo test --test claude_api_account`；`make check`。
- **Boundaries**: 复用 Provider Hub 的 provider/binding 存储，不新建平行体系；所有写入都是事务式（失败还原 `settings.json` 与绑定记录）；`main` 空间必须有显式确认标记才允许写入。

## Tasks

- [ ] `T01` 实现计划器：Claude 直连绑定计划与阻断器。
  - **Test and RED**: 在 `tests/claude_api_account.rs` 断言计划包含目标文件路径、将写入的受管键、备份路径与模型预览；对 `settings.json` 非法、provider 协议不兼容、缺少小模型、默认空间未确认等场景返回对应阻断器。实现前 RED。
  - **Execution logic**: 计划器只读：读取空间信息、provider 与投影记录、计算 beforeHash 与将写入键集合；`main` 空间要求请求携带 `allowDefaultSpace` 确认，否则返回 `default_space_confirmation_required`；阻断器枚举与 Codex 计划器风格一致，便于 UI 复用。
  - **Files and responsibilities**: `src/services/claude_api_account.rs` 拥有计划；`tests/claude_api_account.rs` 拥有计划用例。
  - **Verification**: 正常（计划字段完整）、非法（协议/JSON 错误）、状态（已有绑定、provider 修订变化）、安全（计划不包含明文 token）。
  - **Artifact handoff**: 供 CLD-001-12 的计划预览对话框消费。
- [ ] `T02` 实现执行器：投影写入、绑定记录与失败回滚。
  - **Test and RED**: 断言执行后 `settings.json` 含受管键、绑定记录含 provider id/模型/投影元数据；注入写文件失败后断言原文件与绑定记录均无变化。实现前 RED。
  - **Execution logic**: 顺序为「读取当前文件 → 校验 expectedHash → 写备份 → apply 投影 → 写绑定记录 → 刷新缓存」；任一步失败按逆序还原；并发时以 expectedHash 检测漂移并拒绝；执行结果返回结构化差异供 UI 展示。
  - **Files and responsibilities**: `src/services/claude_api_account.rs` 拥有执行与回滚；`src/services/claude_config_editor.rs` 拥有文件写入；`tests/claude_api_account.rs` 拥有执行/回滚用例。
  - **Verification**: 正常（执行生效）、状态（并发漂移拒绝）、回滚（写绑定失败还原文件）、安全（备份 0600）、边界（首次创建 `settings.json`）。
  - **Artifact handoff**: 执行能力供 CLD-001-12 提交绑定。
- [ ] `T03` 实现 detach 与凭据轮换。
  - **Test and RED**: 断言 detach 逐键校验后完整还原 `settings.json` 并移除绑定；轮换后 Keychain 版本递增、`settings.json` 与 wrapper 内容不变；所有权冲突时拒绝并保留文件。实现前 RED。
  - **Execution logic**: detach 复用投影器校验逻辑，冲突时返回 `OWNERSHIP_CONFLICT` 且不修改；轮换只更新 Keychain 引用版本与绑定记录 revision，不重写配置；两个操作都刷新账号缓存。
  - **Files and responsibilities**: `src/services/claude_api_account.rs` 拥有 detach/rotate；`tests/claude_api_account.rs` 拥有分离/轮换用例。
  - **Verification**: 正常（分离还原）、状态（外部修改冲突）、安全（轮换不改配置文件）、边界（未绑定空间 detach 返回明确错误）。
  - **Artifact handoff**: 完整生命周期供 CLD-001-12 与 CLD-001-14 验收。
- [ ] `T04` 注册 Tauri 命令并校验入参边界。
  - **Test and RED**: 断言新增命令在 `commands/mod.rs` 注册、DTO 为 camelCase、非法 profile id 返回结构化错误而不 panic；测试通过直接调用命令函数完成。实现前 RED。
  - **Execution logic**: 命令层只做参数校验与状态锁，业务逻辑留在服务层；命名沿用既有约定（`plan_claude_api_account`、`execute_claude_api_account`、`detach_claude_api_account`、`rotate_claude_api_account_credential`）；每个命令在文档中登记（CLD-001-14 汇总）。
  - **Files and responsibilities**: `src/commands/mod.rs` 拥有命令注册；`tests/claude_api_account.rs` 拥有命令层用例。
  - **Verification**: 正常（命令返回 DTO）、非法（路径穿越、空 id）、错误（锁竞争返回结构化错误）。
  - **Artifact handoff**: 前端可调用的命令面，供 CLD-001-12/14 消费。

## Tests

- `tests/claude_api_account.rs`：计划阻断器、执行回滚、detach 所有权冲突、轮换、命令参数边界。
- **RED**: 计划/执行函数缺失或明文写入时的失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 需要改写 Codex provider 绑定存储结构时停止并回到设计。
- 默认空间写入无法获得用户显式确认时停止。
- 执行器无法提供原子回滚时停止并回到设计评审。
