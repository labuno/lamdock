# CLD-001-10: Claude resume 与跨空间接力

- **Todo ID**: CLD-001-10
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

用户可复制并执行 Claude resume 命令在指定空间恢复会话；可把单条会话接力到另一个空间（只复制 JSONL），并发起恢复；接力过程绝不复制任何凭据。

## Contract

- **Requirements**: `REQ-OBJ-04`, `REQ-SCP-05`, `REQ-SCP-11`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-07`, `REQ-IF-17`, `REQ-IF-18`, `REQ-WP-E`, `REQ-TM-01`, `REQ-TM-02`, `REQ-VER-01`, `REQ-DONE-03`, `REQ-EXT-07`
- **Produces**: `artifact:claude-handoff` — resume 命令、终端恢复与 JSONL-only 接力。
- **Gates**: `cargo test --test claude_handoff`；`make check`。
- **Boundaries**: 接力只复制会话 JSONL；目标空间已有同名会话时必须显式选择覆盖或跳过；不修改源空间任何文件。

## Tasks

- [ ] `T01` 实现 resume 命令构建与预览。
  - **Test and RED**: 断言命令为 `cd '<cwd>' && CLAUDE_CONFIG_DIR='<home>' claude --resume '<id>'` 形态、含正确 shell 转义；cwd 缺失时退化为不带 cd 并在预览中返回警告码 `cwd_missing`。实现前 RED。
  - **Execution logic**: 从索引读取会话元数据，构造命令文本与警告列表；所有路径与 id 经 shell 引号处理；`main` 空间导出的 `CLAUDE_CONFIG_DIR` 仍显式给出以保持一致性；不读取会话内容正文。
  - **Files and responsibilities**: `src/services/claude_handoff.rs` 拥有命令构建；`tests/claude_handoff.rs` 拥有命令断言。
  - **Verification**: 正常（标准命令）、边界（缺失 cwd、含空格/单引号的路径）、安全（命令不含 token）、非法（会话不存在返回结构化错误）。
  - **Artifact handoff**: 命令构建供 CLD-001-13 的复制/打开终端交互消费。
- [ ] `T02` 实现终端恢复入口与权限预设透传。
  - **Test and RED**: 断言打开终端调用的是用户配置的终端目标、传入命令与预览一致、终端不可用时返回结构化错误；断言命令不回显到日志中的敏感上下文（仅记录会话 id 与 profile）。实现前 RED。
  - **Execution logic**: 复用 Codex 的终端打开实现（Terminal.app/Ghostty 选择逻辑），失败时回退到复制命令并返回可操作的错误信息；调用方可以选择「复制命令」或「打开终端」两种交付方式。
  - **Files and responsibilities**: `src/services/claude_handoff.rs` 拥有终端调用；`src/commands/mod.rs` 注册命令；`tests/claude_handoff.rs` 拥有终端用例（以 stub 终端脚本断言参数）。
  - **Verification**: 正常（终端启动）、错误（终端缺失）、安全（日志字段受控）、边界（命令含特殊字符）。
  - **Artifact handoff**: 供 CLD-001-13 的「恢复」按钮使用。
- [ ] `T03` 实现跨空间接力（JSONL-only）与冲突策略。
  - **Test and RED**: 断言接力后目标空间出现相同 slug 与 UUID 的文件且内容 hash 与源一致；源空间 `.credentials.json`、Keychain 与 `~/.claude.json` 均未被复制；目标已存在同名会话时按请求策略（skip/overwrite）处理并返回明确状态。实现前 RED。
  - **Execution logic**: 顺序为「校验源与目标空间 → 校验会话路径归属 → 创建目标 slug 目录 → 复制文件（先写临时文件再 rename）→ 返回结果与警告」；复制使用字节级复制保证 hash 一致；目标空间无该项目目录时创建；失败清理临时文件；不触碰任何凭据或全局配置。
  - **Files and responsibilities**: `src/services/claude_handoff.rs` 拥有接力；`tests/claude_handoff.rs` 拥有接力与负向安全用例。
  - **Verification**: 正常（接力并可 resume）、状态（skip/overwrite）、回滚（复制失败清理）、安全（零凭据复制、目标目录权限 0700）、边界（目标空间为 `main` 时允许但需确认标记）。
  - **Artifact handoff**: 完成接力闭环，供 CLD-001-13 与 CLD-001-14 验收。

## Tests

- `tests/claude_handoff.rs`：命令形态、cwd 降级、终端 stub、接力复制、冲突策略、凭据零复制。
- **RED**: resume/接力函数缺失或复制出凭据文件时的失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 接力必须复制额外元数据（如 `~/.claude.json` 项目状态）才能恢复会话时停止并回到设计评审。
- 终端打开需要提升权限时停止。
- 目标空间为默认空间且无显式确认时停止。
