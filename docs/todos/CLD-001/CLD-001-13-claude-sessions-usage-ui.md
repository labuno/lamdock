# CLD-001-13: Claude 会话与用量 UI

- **Todo ID**: CLD-001-13
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

Sessions 与 Usage 视图支持 Claude：可列出分页会话、复制/执行 resume、发起跨空间接力与删除；可查看 Claude 用量聚合与额度（含托盘），降级状态有明确文案。

## Contract

- **Requirements**: `REQ-SCP-06`, `REQ-SCP-07`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-08`, `REQ-IF-22`, `REQ-IF-23`, `REQ-WP-G`, `REQ-TM-01`, `REQ-VER-01`, `REQ-VER-02`, `REQ-DONE-03`, `REQ-DONE-04`, `REQ-IF-36`, `REQ-IF-44`
- **Produces**: `artifact:claude-sessions-usage-ui` — Claude 会话视图、接力交互、用量与托盘展示。
- **Gates**: `npm run test:ui`；`make check`。
- **Boundaries**: 不改动 Codex 会话视图行为；删除必须二次确认；接力对话框必须展示将复制/不改动的文件清单。

## Tasks

- [ ] `T01` 实现 Claude 会话列表视图。
  - **Test and RED**: 断言列表展示 id、cwd、摘要、时间与大小，分页游标按「加载更多」推进，空态展示引导，加载失败展示错误并可重试；实现前 RED。
  - **Execution logic**: 复用 Codex 会话表格组件与分页 store 模式；数据来自 CLAUDE 会话查询命令；排序与过滤沿用既有控件；渲染不请求会话正文。
  - **Files and responsibilities**: `src/routes/claude-sessions.tsx` 拥有视图；`src/stores/claude-sessions.ts` 拥有分页状态；测试文件拥有渲染断言。
  - **Verification**: 正常（分页）、边界（空态、重复加载去重）、错误（命令失败提示）、状态（切换空间后重置游标）。
  - **Artifact handoff**: 供 T02 与 CLD-001-14 消费。
- [ ] `T02` 实现 resume 与接力交互。
  - **Test and RED**: 断言复制命令写入剪贴板内容与后端预览一致、打开终端调用对应命令、接力对话框展示「仅复制 JSONL、不复制凭据」清单并在提交后展示结果与冲突策略结果；实现前 RED。
  - **Execution logic**: 复制使用系统剪贴板 API；接力冲突策略默认 `skip` 并要求用户显式选择 `overwrite`；操作完成后刷新列表与用量视图；失败时保留对话框与错误信息。
  - **Files and responsibilities**: `src/components/claude-handoff-dialog.tsx` 拥有对话框；`src/routes/claude-sessions.tsx` 拥有接线；测试文件拥有交互断言。
  - **Verification**: 正常（复制/接力）、状态（冲突策略）、错误（终端失败）、安全（对话框不含 token、清单明确列出排除项）。
  - **Artifact handoff**: 交互闭环供手工验收。
- [ ] `T03` 实现 Claude 用量视图与删除联动。
  - **Test and RED**: 断言用量视图展示按日/模型/空间的聚合与总量，删除会话后对应用量行消失，空库展示引导；实现前 RED。
  - **Execution logic**: 复用既有 Usage 视图的卡片与图表基元但使用 Claude 查询命令；刷新按钮触发索引刷新并展示进度；金额/成本维度在无定价数据时显示「不可用」而不是 0。
  - **Files and responsibilities**: `src/routes/claude-usage.tsx` 拥有视图；`src/stores/claude-usage.ts` 拥有状态；测试文件拥有渲染断言。
  - **Verification**: 正常（聚合展示）、边界（空库、单条记录）、错误（查询失败）、状态（刷新后数据一致）。
  - **Artifact handoff**: 供托盘任务与验收矩阵消费。
- [ ] `T04` 实现托盘 Claude 区块。
  - **Test and RED**: 断言托盘面板在存在 Claude 额度数据时渲染窗口进度条与重置倒计时，数据缺失时展示降级文案；开关关闭时不渲染区块。实现前 RED。
  - **Execution logic**: 复用托盘面板组件与样式；数据来自额度缓存读取命令；只在有绑定额度来源或用户开启采集时展示；不阻塞 Codex 区块渲染。
  - **Files and responsibilities**: `src/tray-quota-app.tsx` 拥有区块；测试文件拥有渲染断言。
  - **Verification**: 正常（渲染）、边界（无数据、开关关闭）、错误（读取失败降级文案）。
  - **Artifact handoff**: 完成 DONE-04 的托盘部分，供 CLD-001-14 验收。

## Tests

- `src/routes/claude-sessions.test.tsx`、`src/components/claude-handoff-dialog.test.tsx`、`src/routes/claude-usage.test.tsx`、`src/tray-quota-app.test.tsx`：列表分页、复制/接力、冲突策略、用量聚合、托盘降级。
- **RED**: 视图与 store 缺失时的渲染失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 需要展示或持久化凭据内容时停止。
- Codex 视图发生回归时停止。
- 托盘渲染需要阻塞主线程或引入新进程时停止并回到设计。
