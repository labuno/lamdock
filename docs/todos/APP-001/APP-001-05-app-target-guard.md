# APP-001-05: App 当前目标查询与切换前置检查

- **Todo ID**: APP-001-05
- **Execution Map**: docs/todos/APP-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/APP-001-app-slot-shared-auth-plan.md`（sha256 见 traceability.json）

## Outcome

后端能回答"Codex App 当前用的是哪个帐号或哪个连接"；App 挂着外部连接或自定义连接时，帐号切换被明确拒绝，不再出现"切换成功但没生效"。

## Contract

- **Requirements**: `REQ-OBJ-02`, `REQ-SCP-02`, `REQ-STP-05`, `REQ-STP-06`, `REQ-IF-03`, `REQ-WP-04`, `REQ-TM-03`
- **Consumes**: `artifact:app-slot-link`
- **Produces**: `artifact:app-target` — `get_app_target` 查询（核心函数、Tauri 命令、前端 API 与类型）和 `switch_to_pat_account` 的前置检查错误码。
- **Gates**: `cargo test --offline --test app_target`；`cargo test --offline --test app_slot_shared_auth`。
- **Boundaries**: 只读查询，不写任何文件；前置检查在改动槽位之前执行；不读取或输出凭据内容；不修改 Provider Hub 存储结构。

## Tasks

- [x] `T01` 编写 App 目标判定与切换前置检查测试并观察 RED。
  - **Test and RED**: 新增 `tests/app_target.rs`：无绑定且 `config.toml` 无 `model_provider` 时为帐号目标（链接目标帐号）；`model_provider = "openai"` 时仍为帐号目标；存在 `main` 绑定时为外部连接目标（provider id 正确）；顶层 `model_provider` 为其他值且无绑定时为自定义连接目标；目标为外部连接或自定义连接时 `switch_to_pat_account` 分别返回 `APP_SLOT_PROVIDER_ATTACHED`、`APP_SLOT_CUSTOM_PROVIDER`，且槽位文件与 `config.toml` 字节不变。实现前因函数不存在编译失败，前置检查用例失败。
  - **Execution logic**: 临时 home；`main` 绑定通过 Provider Hub 绑定存储的公开接口写入夹具，不调用钥匙串与网关。
  - **Files and responsibilities**: `apps/desktop/src-tauri/tests/app_target.rs`。
  - **Verification**: 运行 Gate 记录 RED。
  - **Artifact handoff**: 用例集作为 T02 的验收标准。
- [x] `T02` 实现 App 目标判定与前置检查。
  - **Test and RED**: T01 用例。
  - **Execution logic**: 新模块 `services/app_target.rs` 提供 `get_app_target(home_root) -> AppTarget`（`kind` 为 `account` / `provider` / `customProvider`，附带可选的 `accountId` 或 `providerId`），按设计 4.6 的顺序判定；`config.toml` 用现有 TOML 解析读取顶层 `model_provider`，解析失败按帐号目标处理并不报错；`switch_to_pat_account` 在任何文件操作前调用它。
  - **Files and responsibilities**: `src/services/app_target.rs`（判定）、`src/services/mod.rs`（导出）、`src/services/account.rs`（前置检查）。
  - **Verification**: 正常（三类目标）、边界（`openai`、无 `config.toml`、无法解析的 `config.toml`）、错误（两个新错误码且无副作用）、安全（错误信息不含凭据）。
  - **Artifact handoff**: 核心查询与错误码。
- [x] `T03` 暴露 Tauri 命令与前端 API。
  - **Test and RED**: `src/lib/api.test.ts` 增加 `getAppTarget` 调用 `get_app_target` 并返回类型化结果的用例，实现前失败。
  - **Execution logic**: `commands/mod.rs` 新增 `get_app_target` 命令并注册；`src/lib/types.ts` 增加 `AppTarget` 联合类型；`src/lib/api.ts` 增加 `getAppTarget()`。
  - **Files and responsibilities**: `src-tauri/src/commands/mod.rs`、`src-tauri/src/main.rs` 或命令注册处、`src/lib/types.ts`、`src/lib/api.ts`、`src/lib/api.test.ts`。
  - **Verification**: Rust Gate 与 `npm test -- src/lib/api.test.ts` 通过。
  - **Artifact handoff**: 产出 `artifact:app-target`，供 APP-001-06 使用。

## Tests

- `tests/app_target.rs`：三类目标判定、两个前置检查错误码及无副作用。
- `src/lib/api.test.ts`：`getAppTarget` 命令映射。
- **RED**: 实现前编译失败或前置检查用例失败。

## Evidence（2026-11-10）

- **RED**：`tests/app_target.rs` 因 `get_app_target`、`AppTarget`、`AppTargetKind` 不存在编译失败；`api.test.ts` 中 `getAppTarget is not a function`。
- **GREEN**：`app_target` 9 passed；`app_slot_shared_auth` 15 passed；`integration_pat_accounts` 15 passed；`--lib account` 21 passed；`api.test.ts` 13 passed；`tsc --noEmit` 通过；clippy 对改动文件无告警。
- **实现说明**：Provider Hub 目录不存在时直接判定无绑定，不创建目录，查询保持只读。provider 显示名由前端从 Providers 列表解析（设计 4.6 已同步）。
- **Handoff**：前端用 `api.getAppTarget()`；切换失败时据错误码 `APP_SLOT_PROVIDER_ATTACHED` / `APP_SLOT_CUSTOM_PROVIDER` 区分处理。

## Done

- [x] T01–T03 完成，Gate 通过，证据写入 execution-map。

## STOP conditions

- 读取 `main` 绑定需要改动 Provider Hub 存储结构：停止，回到设计评审。
- 判定需要读取凭据内容：停止，改为只用文件类型与绑定信息。
