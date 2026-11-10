# CLD-001-03: Claude 空间生命周期与 wrapper

- **Todo ID**: CLD-001-03
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

用户可在 LAM 中看到 `~/.claude` 默认空间与 `~/.claude-<name>` 受管空间，创建/重命名/删除空间，并得到一个导出 `CLAUDE_CONFIG_DIR` 的 `claude-<name>` wrapper；全流程不复制任何凭据。

## Contract

- **Requirements**: `REQ-OBJ-02`, `REQ-SCP-01`, `REQ-SCP-08`, `REQ-SCP-11`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-04`, `REQ-IF-02`, `REQ-IF-03`, `REQ-IF-04`, `REQ-IF-05`, `REQ-WP-B`, `REQ-TM-01`, `REQ-TM-03`, `REQ-TM-04`, `REQ-VER-01`, `REQ-DONE-01`, `REQ-EXT-01`, `REQ-IF-37`, `REQ-IF-38`, `REQ-TM-06`, `REQ-TM-07`, `REQ-TM-08`
- **Produces**: `artifact:claude-space-lifecycle` — 可发现/创建/重命名/删除的 Claude 空间与 wrapper 生成。
- **Gates**: `cargo test --test claude_spaces`；`make check`。
- **Boundaries**: 不改动、不补丁 Claude Code；`main` 不生成 wrapper；创建失败必须完全回滚；禁止复制 `.credentials.json`、Keychain 与 `~/.claude.json`。

## Tasks

- [ ] `T01` 实现 Claude 空间发现与信号判定。
  - **Test and RED**: 在 `tests/claude_spaces.rs` 构造 fake home：`~/.claude` 含 `settings.json`、`~/.claude-a` 含 `projects/`、`~/.claude-empty` 无信号。断言只识别前两个，且 `main` 的 `wrapperPath` 为 `None`。实现前编译失败为 RED。
  - **Execution logic**: 复用 Codex 的扫描骨架但通过 `AgentRegistry` 注册 Claude backend；信号集合按计划 4.2；对每个空间读取 marker 与 notes；识别失败的目录跳过而不是报错；结果写入 Claude 账号缓存。
  - **Files and responsibilities**: `src/services/claude_spaces.rs` 拥有扫描与信号；`src/services/agent_backend_claude.rs` 拥有注册；`tests/claude_spaces.rs` 拥有发现测试。
  - **Verification**: 正常（默认+受管）、边界（空目录、仅 `.credentials.json`）、安全（不读取凭据内容，仅判断存在性）、状态（同名不同大小写目录视为不同空间并给出提示）。
  - **Artifact handoff**: `artifact:claude-space-lifecycle` 提供发现能力，供 CLD-001-06/09/12 消费。
- [ ] `T02` 实现空间创建与 wrapper 生成（含回滚）。
  - **Test and RED**: 断言创建 `b` 后存在 `~/.claude-b/`、marker、`~/.local/bin/claude-b` 且脚本包含 `CLAUDE_CONFIG_DIR="$HOME/.claude-b"` 与 `exec claude "$@"`；再注入目录创建失败断言无残留。实现前 RED。
  - **Execution logic**: 校验 profile id（正则、长度、保留字 `main`）、检查同名目录与 wrapper 冲突、创建目录 0700、写 marker、写 wrapper 0755；任一步失败按逆序删除本次创建的文件；wrapper 内容复用 Codex 的 PATH 警告与 `CLAUDE_BIN`/`claude` 解析顺序；不复制 `config.toml` 或任何凭据。
  - **Files and responsibilities**: `src/services/claude_spaces.rs` 拥有创建与回滚；`tests/claude_spaces.rs` 拥有创建/回滚用例。
  - **Verification**: 正常（创建）、非法（路径穿越、空 id、保留字）、状态（已存在同名空间/wrapper）、回滚（目录或 wrapper 写失败）、安全（目录 0700、文件 0600/0755）、边界（超长 id）。
  - **Artifact handoff**: 提供可创建的空间，供 CLD-001-04 登录与 CLD-001-12 UI 使用。
- [ ] `T03` 实现重命名与删除空间。
  - **Test and RED**: 断言重命名后旧路径与旧 wrapper 不存在、新路径与新 wrapper 生效、marker 更新；删除后空间目录、wrapper、marker 消失且暂存目录为空。实现前 RED。
  - **Execution logic**: 重命名先校验目标不存在，再移动目录并重写 wrapper/marker，失败逆序恢复；删除先终止引用该 home 的进程（复用 Codex 进程检测，按命令行匹配 `CLAUDE_CONFIG_DIR` 与 wrapper 路径），再移动到 LAM 暂存目录后清理，最后清理 Claude 缓存条目与 notes。
  - **Files and responsibilities**: `src/services/claude_spaces.rs` 拥有重命名/删除；`tests/claude_spaces.rs` 拥有生命周期用例。
  - **Verification**: 正常（重命名、删除）、边界（删除正在运行的空间必须拒绝或先终止并给出提示）、状态（目标已存在）、回滚（移动失败恢复）、安全（不触碰凭据文件本身，只随目录一起删除受管空间）。
  - **Artifact handoff**: 生命周期完整，供 CLD-001-12 的删除/重命名对话框消费。
- [ ] `T04` 端到端负向验证：不复制凭据与全局状态。
  - **Test and RED**: 在源空间放置 `.credentials.json` 与 `~/.claude.json`，执行创建、重命名、删除与（占位）接力路径后，断言目标空间不存在这两个文件的副本且源文件未被修改。实现前 RED。
  - **Execution logic**: 该任务只增加测试与断言，不新增功能；如发现实现复制了凭据，回到 T02/T03 修复而不是放宽断言。
  - **Files and responsibilities**: `tests/claude_spaces.rs` 拥有负向安全用例。
  - **Verification**: 安全（零复制）、状态（源文件 hash 不变）、边界（源空间没有凭据时不报错）。
  - **Artifact handoff**: 为 CLD-001-10 的接力负向测试提供可复用的 fixture 构造函数。

## Tests

- `tests/claude_spaces.rs`：发现、创建、冲突、回滚、重命名、删除、凭据零复制。
- **RED**: Claude backend 未注册、wrapper 未生成、删除无暂存时的断言失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- Claude Code 的目录/信号假设与实测冲突时停止并更新源计划。
- 创建/删除需要用户级外部权限（如 sudo）时停止。
- 发现必须复制凭据才能让空间可用时停止并回到设计。
