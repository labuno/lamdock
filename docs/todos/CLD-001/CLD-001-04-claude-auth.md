# CLD-001-04: Claude 登录与会话凭据探测

- **Todo ID**: CLD-001-04
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

每个 Claude 空间都有可用的登录入口（在用户终端内完成官方 `/login`），LAM 能探测登录状态、凭据来源与过期时间，并支持用户显式导入凭据 JSON；LAM 自身不实现 OAuth、不读取浏览器凭据、不输出 token 原文。

## Contract

- **Requirements**: `REQ-OBJ-04`, `REQ-SCP-02`, `REQ-SCP-08`, `REQ-SCP-09`, `REQ-SCP-11`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-04`, `REQ-IF-06`, `REQ-IF-07`, `REQ-IF-24`, `REQ-WP-B`, `REQ-TM-01`, `REQ-TM-02`, `REQ-TM-05`, `REQ-VER-01`, `REQ-DONE-01`, `REQ-STOP-03`, `REQ-STOP-04`, `REQ-EXT-01`, `REQ-EXT-03`, `REQ-EXT-05`, `REQ-IF-41`, `REQ-EXT-06`
- **Produces**: `artifact:claude-auth-state` — 登录入口、凭据探测与认证元数据。
- **Gates**: `cargo test --test claude_auth`；`make check`。
- **Boundaries**: 不逆向 OAuth 客户端；不转发浏览器凭据；token 原文永不进入 DTO、日志或前端状态；Keychain 命名规则以探针测试为准。

## Tasks

- [ ] `T01` 实现终端登录入口与命令构建。
  - **Test and RED**: 在 `tests/claude_auth.rs` 断言登录命令包含 `CLAUDE_CONFIG_DIR` 与目标空间路径、`claude` 解析顺序为 `CLAUDE_BIN` 再到 PATH、`main` 空间不带目录导出前缀为可选。实现前 RED。
  - **Execution logic**: 复用 Codex `open_terminal_for_login` 的终端目标与 AppleScript 打开逻辑；命令执行的是官方 CLI（`claude`），入口只负责环境与提示，不注入任何 token；返回结构化错误码区分「空间不存在」「终端不可用」「claude 未安装」。
  - **Files and responsibilities**: `src/services/claude_auth.rs` 拥有命令与终端调用；`tests/claude_auth.rs` 拥有命令断言。
  - **Verification**: 正常（构建命令）、边界（`main` 空间）、错误（二进制缺失）、安全（命令文本不得包含 token）。
  - **Artifact handoff**: `artifact:claude-auth-state` 提供登录入口，供 CLD-001-12 UI 触发。
- [ ] `T02` 实现凭据探测与 Keychain 命名探针。
  - **Test and RED**: 断言探测顺序为 Keychain 优先、`.credentials.json` 回退；在 Keychain 不可用时返回 `authMode=unknown` 且不报错；探针测试固定默认空间无后缀、非默认空间带指纹后缀的推导，并在 `security` 命令失败时降级。实现前 RED。
  - **Execution logic**: 通过 `security find-generic-password` 读取默认与带后缀 service；解析 JSON 取 `expiresAt`、订阅层级等展示字段后立即丢弃 token 字段；任何失败都降级为文件探测；探针以 `#[cfg(target_os = "macos")]` 隔离，非 macOS 直接走文件路径。
  - **Files and responsibilities**: `src/services/claude_auth.rs` 拥有探测；`tests/claude_auth.rs` 拥有探针与降级用例。
  - **Verification**: 正常（两种来源）、错误（Keychain 失败、JSON 损坏、过期凭据）、边界（无凭据空间）、安全（返回值不含 token 字段）。
  - **Artifact handoff**: 探测结果为 CLD-001-06/11 提供账号状态与凭据引用依据。
- [ ] `T03` 实现显式凭据导入与认证元数据。
  - **Test and RED**: 断言导入 `.credentials.json` 内容后目标空间只出现该文件（0600），且 `claude-auth-metadata/<profile>.json` 记录来源、过期时间与导入时间；非法 JSON、缺少必需字段时返回结构化错误且不落盘。实现前 RED。
  - **Execution logic**: 导入仅接受用户显式提交的内容；校验必需字段与 JSON 结构；写入采用临时文件 + rename；元数据只保存来源类型、过期时间与订阅层级，不保存 token；导入后刷新账号缓存；发现凭据过期时只标记状态，不自动删除。
  - **Files and responsibilities**: `src/services/claude_auth.rs` 拥有导入；`src/services/agent_store.rs` 拥有元数据读写；`tests/claude_auth.rs` 拥有导入用例。
  - **Verification**: 正常（导入并刷新）、非法（非法 JSON/缺字段）、安全（0600、无 token 泄漏）、状态（重复导入幂等）、边界（过期时间与当前时间相邻）。
  - **Artifact handoff**: 完成账号状态闭环，供 CLD-001-12 展示「已登录/已过期/未知」。

## Tests

- `tests/claude_auth.rs`：命令构建、Keychain 探针与回退、导入校验、降级、无 token 泄漏。
- **RED**: 登录/探测/导入函数缺失时的编译失败与断言失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 实测证明必须使用非公开 OAuth 端点才能完成登录时停止。
- Keychain 命名探针无法稳定推导且文件回退不可用导致无法判断登录状态时停止并上报。
- 任何设计需要通过 LAM 转发或存储浏览器凭据时停止。
