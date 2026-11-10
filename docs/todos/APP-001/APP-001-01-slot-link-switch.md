# APP-001-01: 链接式切换与槽位凭据保全

- **Todo ID**: APP-001-01
- **Execution Map**: docs/todos/APP-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/APP-001-app-slot-shared-auth-plan.md`（sha256 见 traceability.json）

## Outcome

PAT 切换不再复制凭据，而是把 App 槽位（`~/.codex/auth.json` 与 `auth-f.json`）链接到目标帐号目录中的同名文件；切换前槽位里的普通文件凭据被写回所属帐号或导入为新帐号；API Key 帐号被拒绝。

## Contract

- **Requirements**: `REQ-OBJ-01`, `REQ-SCP-01`, `REQ-SCP-02`, `REQ-STP-01`, `REQ-STP-02`, `REQ-IF-02`, `REQ-WP-01`, `REQ-TM-01`, `REQ-STOP-01`, `REQ-EXT-01`
- **Produces**: `artifact:app-slot-link` — 链接式 `switch_to_pat_account` 与槽位保全规则。
- **Gates**: `cargo test --offline --test app_slot_shared_auth`；`cargo test --offline --test integration_pat_accounts`；`cargo test --offline --lib account`。
- **Boundaries**: 不修改 `~/.codex/config.toml`；命令名与参数不变；不输出 token 原文；只用假凭据测试。

## Tasks

- [x] `T01` 编写切换与保全的集成测试并观察 RED。
  - **Test and RED**: 新增 `tests/app_slot_shared_auth.rs`：链接建立且经槽位写入落到帐号文件；帐号之间切换不改动凭据；未知凭据导入为 `app-<后缀>` 且重名追加序号；较新凭据写回、较旧凭据不覆盖；团队帐号按用户标识匹配；API Key 帐号返回 `APP_SLOT_API_KEY_UNSUPPORTED` 且槽位不变。实现前除"较旧凭据不覆盖"外均应失败。
  - **Execution logic**: 测试用临时 home 与自造 JWT，不依赖真实帐号或网络；用 `fs::read_link` 断言链接目标，用经槽位路径的写入模拟 Codex 刷新。
  - **Files and responsibilities**: `apps/desktop/src-tauri/tests/app_slot_shared_auth.rs` 拥有全部切换与保全用例。
  - **Verification**: 运行 `cargo test --offline --test app_slot_shared_auth`，记录失败用例清单作为 RED 证据。
  - **Artifact handoff**: 用例集是 T02、T03 的验收标准，也供 APP-001-02 扩展。
- [x] `T02` 实现链接式切换与 API Key 拒绝。
  - **Test and RED**: T01 中链接、切换、API Key 用例。
  - **Execution logic**: 校验帐号与 `auth.json`；读取凭据判断 API Key（`auth_mode=apikey`，或有 `OPENAI_API_KEY` 且无 `tokens`）；对 `auth.json`、`auth-f.json` 先建临时符号链接再 rename 原子替换，帐号缺少的文件从槽位删除；最后比对槽位内容与帐号文件。
  - **Files and responsibilities**: `apps/desktop/src-tauri/src/services/account.rs` 拥有 `switch_to_pat_account`、`link_app_slot_file`、`remove_app_slot_file`、`auth_is_api_key`。
  - **Verification**: 正常（建立与重建链接）、错误（无帐号、无凭据、API Key）、边界（`auth-f.json` 有无切换）、安全（错误信息不含 token）。
  - **Artifact handoff**: 产出 `artifact:app-slot-link` 的链接部分。
- [x] `T03` 实现槽位普通文件凭据的保全与导入。
  - **Test and RED**: T01 中导入、重名、写回、不覆盖、团队匹配用例。
  - **Execution logic**: 槽位为普通文件时：内容与某帐号完全相同则跳过；按 `account_id` 加 `id_token` 用户标识匹配唯一所属帐号，`last_refresh` 更新时写回；否则抽出 Session 导入的建目录逻辑为 `write_profile_space`，导入为 `app-<account_id 末 6 位>`，并复制槽位中的普通 `auth-f.json`。
  - **Files and responsibilities**: `account.rs` 拥有 `preserve_unlinked_app_credentials`、`auth_identity`、`auth_last_refresh`、`import_app_credentials`、`write_profile_space`。
  - **Verification**: 正常（写回、导入）、边界（重名、缺少 `last_refresh`、无法解析的 JSON 也导入）、状态（重复切换幂等，不重复导入）。
  - **Artifact handoff**: 补全 `artifact:app-slot-link` 的保全规则。
- [x] `T04` 把既有 PAT 测试改为链接语义。
  - **Test and RED**: `integration_pat_accounts.rs` 与 `account.rs` 单元测试 `pat_switch_*` 现在断言复制结果；改为断言链接目标与经链接读取的内容。
  - **Execution logic**: 只改断言语义，不删除覆盖点；保留 `MAIN_AUTH_SLOT` 等既有错误用例。
  - **Files and responsibilities**: `tests/integration_pat_accounts.rs`、`src/services/account.rs` 测试模块。
  - **Verification**: 三个 Gate 命令全部通过。
  - **Artifact handoff**: 回归基线交给 APP-001-02。

## Tests

- `tests/app_slot_shared_auth.rs`：切换、保全、导入、API Key 拒绝。
- `tests/integration_pat_accounts.rs` 与 `account.rs` 单元测试：链接语义回归。
- **RED**: 复制式实现下链接、导入、写回与 API Key 用例失败。

## Evidence（2026-11-10）

- **RED**（复制式实现 + 新测试）：`app_slot_shared_auth` 8 例中 7 例失败，仅"较旧凭据不覆盖"通过；`integration_pat_accounts` 的 `test_add_and_switch_pat_account` 与单元测试 `pat_switch_links_and_removes_auth_f_json` 因断言链接目标而失败。
- **GREEN**：`app_slot_shared_auth` 11 passed；`integration_pat_accounts` 15 passed；`--lib account` 21 passed。clippy 对改动文件无告警。
- **补充边界用例**（实现后补写，作为回归而非 RED 驱动）：缺少 `last_refresh` 不覆盖、无法解析的 JSON 导入为 `app-import`、重复切换只导入一次。
- **Handoff**：APP-001-02 可在 `app_slot_shared_auth.rs` 上追加当前帐号识别、删除、重命名用例；`APP_SLOT_AUTH_FILES`、`link_app_slot_file`、`remove_app_slot_file` 可直接复用。

## Done

- [x] T01–T04 完成，三个 Gate 通过，证据写入 execution-map。
- [x] 经槽位写入的内容出现在帐号文件中（测试断言）。

## STOP conditions

- 实现需要改动 `~/.codex/config.toml` 才能通过测试：停止并回到设计评审。
- 任一用例显示用户凭据可能被覆盖且无法保全：停止并报告。
