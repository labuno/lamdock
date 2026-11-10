# APP-001-04: 全量检查、真实 App 验收与文档

- **Todo ID**: APP-001-04
- **Execution Map**: docs/todos/APP-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/APP-001-app-slot-shared-auth-plan.md`（sha256 见 traceability.json）

## Outcome

全量检查通过；在真实 Codex App 上确认接力可用、token 刷新不破坏链接；README 与手工验收清单反映新行为。

## Contract

- **Requirements**: `REQ-WP-03`, `REQ-VER-01`, `REQ-VER-02`, `REQ-VER-03`, `REQ-DONE-01`, `REQ-STOP-01`
- **Consumes**: `artifact:app-slot-lifecycle`, `artifact:pat-switch-ui`, `artifact:app-target-ui`
- **Produces**: `artifact:app-slot-acceptance` — 检查与验收证据、更新后的文档。
- **Gates**: `make check`。
- **Boundaries**: 真实验收由用户操作或在用户确认后进行；不在验收中删除真实帐号；验收结果与自动检查分开记录。

## Tasks

- [ ] `T01` 运行全量检查。
  - **Test and RED**: 不新增测试；`make check` 失败即视为回归，回到对应节点修复。
  - **Execution logic**: 在仓库根目录运行 `make check`，覆盖前端构建、Vitest、ESLint、Node 脚本、UI smoke、Rust fmt、Clippy 与全部 Rust 测试。
  - **Files and responsibilities**: 无新增文件；回归修复归属原节点。
  - **Verification**: `make check` 退出码为 0。
  - **Artifact handoff**: 检查结果写入 execution-map 证据。
- [ ] `T02` 真实 Codex App 验收。
  - **Test and RED**: 手工场景：首次切换时本机未链接凭据被导入为 `app-` 帐号；切换后 App 能继续对话；token 刷新后槽位仍是链接且帐号文件 `last_refresh` 更新；同一帐号在 Profile 模式 CLI 中同时可用；App 内退出登录只删除链接；重命名、删除被链接帐号的结果符合设计 4.4。连接切换（设计 4.6）：External API 帐号接管 App 后可对话；切回 ChatGPT 帐号时出现确认，确认后 App 可对话且原 OpenAI 对话恢复可写；External API 帐号在 Profile 模式 CLI 中全程可用。
  - **Execution logic**: 用新构建的 LamDock；每步用 `ls -l ~/.codex/auth.json` 与字段名检查（不打印 token）记录状态；发现链接被替换为普通文件即触发停止条件。
  - **Files and responsibilities**: `docs/manual-acceptance.md` 记录场景、日期、版本与结果。
  - **Verification**: 所有场景结果为通过，或记录具体阻碍。
  - **Artifact handoff**: 验收记录。
- [ ] `T03` 更新文档并收尾。
  - **Test and RED**: 不新增自动测试；改动文档中的相对链接逐一确认目标文件存在。
  - **Execution logic**: README（中英）PAT 模式一节改为"共享同一份凭据、ChatGPT 帐号与 External API 帐号都可接管 App、API Key 格式的 Codex 帐号走 Profile、界面显示 App 当前目标"，并加入不要对默认目录执行 `codex login` 的提示；计划文档状态改为已实施；`docs/TODO.md` 与 `docs/README.md` 增加入口。
  - **Files and responsibilities**: `README.md`、`README.zh-CN.md`、`docs/APP-001-app-slot-shared-auth-plan.md`、`docs/TODO.md`、`docs/README.md`。
  - **Verification**: 相对链接目标均存在；校验脚本 `validate_todo_graph.py` 通过。
  - **Artifact handoff**: 产出 `artifact:app-slot-acceptance`。

## Tests

- `make check` 全量回归。
- 手工验收场景见 T02。
- **RED**: 不适用新的自动测试；以回归失败和验收失败为准。

## Evidence（2026-11-10）

- **T01**：首次 `make check` 在 `cargo fmt --check` 失败（`services/mod.rs` 中 `app_target` 模块声明顺序，属节点 05 遗留），已修正。第二次失败在 `quota::tests::proxy_curl_sends_requests_via_the_configured_proxy`：基线遗留的偶发测试，与本改动无关。单独运行 6/6 通过，第三次 `make check` 退出码 0。
- **T02**：待用户在真实 Codex App 上验收，场景已写入 `docs/manual-acceptance.md` 的 APP-001 行。
- **T03**：README 中英文 PAT 一节、手工验收清单、`docs/README.md` 与 `docs/TODO.md` 入口已更新；计划状态改为"已实施，待真实 Codex App 验收"。

## Done

- [x] T01、T03 完成，`make check` 证据写入 execution-map。
- [ ] T02 真实 Codex App 验收。
- [ ] 所有节点状态为验证成功。

## STOP conditions

- 真实验收中 Codex 刷新 token 后槽位变回普通文件：停止，回到设计评估"复制加写回"方案。
- 验收需要删除或覆盖真实凭据才能继续：停止并请用户决定。
