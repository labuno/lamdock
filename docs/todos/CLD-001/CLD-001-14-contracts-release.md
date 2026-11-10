# CLD-001-14: 命令契约、文档与发布验收

- **Todo ID**: CLD-001-14
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

CLD-001 的全部新命令、类型与配置契约被登记进仓库文档；README 与设计文档更新；使用真实 `claude` 二进制与两类上游完成手工验收矩阵；发布前 `make check` 与 `make build` 通过且 Codex 无回归。

## Contract

- **Requirements**: `REQ-OBJ-01`, `REQ-OBJ-03`, `REQ-SCP-07`, `REQ-SCP-10`, `REQ-SCP-12`, `REQ-SCP-13`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-08`, `REQ-WP-G`, `REQ-TM-01`, `REQ-VER-01`, `REQ-VER-04`, `REQ-VER-05`, `REQ-DONE-05`, `REQ-STOP-01`, `REQ-STOP-02`, `REQ-EXT-04`, `REQ-IF-43`, `REQ-STOP-05`
- **Produces**: `artifact:cld-001-contracts` — 命令契约文档、README/设计更新与手工验收矩阵。
- **Gates**: `make check`；`make build`。
- **Boundaries**: 文档只登记已实现并验证的行为；不得把未验证能力写成已交付；不修改既有 Codex 契约描述。

## Tasks

- [ ] `T01` 更新命令契约与前端类型文档。
  - **Test and RED**: 断言 `docs/05-tauri-command-contracts.md` 包含全部新命令签名与 DTO 字段、`src/lib/types.ts` 与文档字段一致；以脚本对比命令名集合，缺失即失败（RED）。
  - **Execution logic**: 从 `commands/mod.rs` 提取 `#[tauri::command]` 名称集合，与文档中的命令表比对；新增「Agent/Claude」章节；保持既有章节顺序与风格；类型示例直接引用真实 DTO。
  - **Files and responsibilities**: `docs/05-tauri-command-contracts.md` 拥有契约；`apps/desktop/scripts/check-command-contracts.mjs`（或等价测试）拥有比对脚本；`make check` 接入该脚本。
  - **Verification**: 正常（命令全覆盖）、边界（无新增命令时脚本通过）、错误（文档缺命令时失败退出非零）。
  - **Artifact handoff**: 契约一致性检查进入 `make check`，供后续 agent 扩展复用。
- [ ] `T02` 更新 README 与设计文档。
  - **Test and RED**: 断言 README（中英）新增 Claude 章节与截图占位、`docs/FINAL-DESIGN.md` 的 Agent 抽象标注为已实现、源计划与执行图互相引用；文档链接检查脚本对缺失链接失败（RED）。
  - **Execution logic**: README 描述用户可见能力与限制（含默认空间只读、额度默认关闭）；设计文档更新 Agent/AgentProfile 状态与 Claude 差异说明；不夸大未完成能力，未实现项明确标注。
  - **Files and responsibilities**: `README.md`、`README.zh-CN.md`、`docs/FINAL-DESIGN.md` 拥有文档；链接检查脚本拥有验证。
  - **Verification**: 正常（链接有效）、边界（相对链接大小写）、错误（死链失败）。
  - **Artifact handoff**: 文档与实现一致，供发布说明引用。
- [ ] `T03` 执行真实二进制手工验收矩阵。
  - **Test and RED**: 在真实环境按矩阵逐项执行：创建空间、首次登录、直连调用、网关调用、resume、跨空间接力、删除空间；每项记录命令、观察结果与截图/日志；任一项失败即该项 FAIL 并停止后续项（RED）。
  - **Execution logic**: 使用独立测试 home（`LAM_HOME` 指向临时目录）避免污染真实数据；至少一个 Anthropic 兼容上游与一个 Chat Completions 上游；记录 Claude Code 版本与 LAM 版本；失败项记录复现步骤并回填到对应节点。
  - **Files and responsibilities**: `docs/CLD-001-acceptance-matrix.md` 拥有矩阵与结果；相关节点 todo 追加 Evidence。
  - **Verification**: 正常（七项全过）、错误（记录失败与复现）、安全（矩阵与日志中不出现 token）。
  - **Artifact handoff**: 验收证据供发布决策与用户文档使用。
- [ ] `T04` 发布前兼容与构建 Gate。
  - **Test and RED**: 运行 `make check`、`make build`，并断言 Codex 兼容性检查项（缓存文件、命令 DTO、wrapper 文本）与基线一致；任一失败即 RED 并定位到对应节点。
  - **Execution logic**: 在干净工作区执行全量 Gate；记录耗时与失败日志；确认版本号与变更日志更新；确认无新增编译警告（`clippy -D warnings`）。
  - **Files and responsibilities**: `apps/desktop/package.json`、`src-tauri/Cargo.toml`（版本与脚本）与执行记录文件拥有职责。
  - **Verification**: 正常（全绿）、错误（失败定位）、边界（空缓存首次运行）。
  - **Artifact handoff**: 发布就绪证据，完成 CLD-001 的 Done 标准。

## Tests

- 命令契约比对脚本、文档链接检查、手工验收矩阵记录、`make check`/`make build` 全量输出。
- **RED**: 文档缺命令、死链、验收矩阵失败项、Gate 失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 任一验收项失败且无法在对应节点内修复时停止并上报。
- 需要修改既有 Codex 契约或缓存格式才能发布时停止。
- 文档无法与实测行为一致时停止并回到源计划更新。
