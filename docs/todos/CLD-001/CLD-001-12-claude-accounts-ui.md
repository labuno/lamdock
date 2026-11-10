# CLD-001-12: Claude 账号与 Agent 切换 UI

- **Todo ID**: CLD-001-12
- **Execution Map**: docs/todos/CLD-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/CLD-001-claude-agent-support-plan.md` (sha256 ee46f48d077c678ba3911b302f31a6ff208ff293565d73939f10fd1d53894d8d)

## Outcome

桌面应用中可按 agent 切换账号视图；Claude 账号卡片展示登录状态与额度徽标；用户可在界面创建/重命名/删除空间、打开登录终端，并以与 Codex 一致的交互新增 external API 账号（含模型映射）。

## Contract

- **Requirements**: `REQ-OBJ-01`, `REQ-OBJ-02`, `REQ-SCP-07`, `REQ-STP-01`, `REQ-STP-02`, `REQ-STP-08`, `REQ-IF-23`, `REQ-IF-24`, `REQ-WP-G`, `REQ-TM-01`, `REQ-TM-02`, `REQ-VER-01`, `REQ-VER-02`, `REQ-DONE-01`, `REQ-DONE-02`, `REQ-IF-34`, `REQ-IF-44`, `REQ-TM-06`
- **Produces**: `artifact:claude-accounts-ui` — agent 切换器、Claude 账号视图与 API 账号对话框。
- **Gates**: `npm run test:ui`；`make check`。
- **Boundaries**: 不在前端状态或日志中出现 token；Claude 视图不得改动 Codex 视图行为；所有写操作必须走已注册命令。

## Tasks

- [ ] `T01` 实现 agent 切换器与状态接线。
  - **Test and RED**: 在 `src/components/agent-switcher.test.tsx` 断言默认显示 Codex、切换到 Claude 后账号列表来源变为 Claude store、切换状态在刷新后保持；实现前组件不存在为 RED。
  - **Execution logic**: 新增受控组件（All/Codex/Claude 三态按视图需要裁剪为两态），状态提升到 `App.tsx` 并持久化到 localStorage；切换只影响视图过滤，不触发账号扫描循环。
  - **Files and responsibilities**: `src/components/agent-switcher.tsx` 拥有组件；`src/stores/agents.ts` 拥有状态；测试文件拥有交互断言。
  - **Verification**: 正常（切换）、边界（无 Claude 账号时显示引导）、状态（刷新后保持）；安全与并发维度不适用（纯前端状态）。
  - **Artifact handoff**: 供 T02/T03 与 CLD-001-13 复用。
- [ ] `T02` 实现 Claude 账号列表与卡片。
  - **Test and RED**: 断言卡片展示 `displayName`、空间路径、登录状态（已登录/已过期/未知）、额度徽标与告警；数据为空时展示创建引导；断言卡片 DOM 中不出现任何疑似 token 字符串。实现前 RED。
  - **Execution logic**: 列表数据来自 `list_claude_accounts` 命令（薄封装于 `api.ts`）；卡片复用 Codex 卡片视觉与 `QuotaWindow` 组件；登录状态映射为本地化文案；额度缺失时显示降级原因。
  - **Files and responsibilities**: `src/routes/claude-accounts.tsx` 拥有视图；`src/lib/claude-api.ts` 拥有命令封装；测试文件拥有渲染断言。
  - **Verification**: 正常（渲染）、边界（长路径截断、无额度）、安全（无 token 字样）、状态（刷新失败保留旧数据并提示）。
  - **Artifact handoff**: 供 CLD-001-14 验收矩阵引用。
- [ ] `T03` 实现空间创建/重命名/删除与登录入口交互。
  - **Test and RED**: 断言创建对话框提交后调用创建命令并刷新列表、非法 id 就地报错、删除需二次确认、登录按钮调用打开终端命令且展示提示文案；实现前 RED。
  - **Execution logic**: 表单校验与命令阻断器错误码映射到可读文案；破坏性操作使用既有确认对话框组件；登录成功后由用户手动刷新或轮询一次账号状态。
  - **Files and responsibilities**: `src/components/claude-space-dialogs.tsx` 拥有对话框；`src/routes/claude-accounts.tsx` 拥有接线；测试文件拥有交互断言。
  - **Verification**: 正常（创建/删除/登录）、非法（路径穿越、保留字）、错误（命令返回结构化错误时展示 message）、安全（不回显凭据）。
  - **Artifact handoff**: 交互闭环供 CLD-001-14 手工验收。
- [ ] `T04` 实现 external API 账号对话框（协议选择与模型映射）。
  - **Test and RED**: 断言选择 `anthropic_messages` 时展示模型与小模型映射选择器、提交调用计划与执行命令并展示差异预览；选择不兼容协议时禁用提交并说明原因；计划阻断器映射为可读文案。实现前 RED。
  - **Execution logic**: 复用 Codex API 账号流程的向导结构；模型列表来自 provider 模型发现结果；`allowDefaultSpace` 确认仅在用户显式勾选时下发；执行成功后刷新卡片展示绑定信息。
  - **Files and responsibilities**: `src/components/claude-api-account-flow.tsx` 拥有向导；测试文件拥有交互断言。
  - **Verification**: 正常（两协议选项）、边界（模型为空）、错误（阻断器）、安全（不显示密钥原文）。
  - **Artifact handoff**: 供 CLD-001-14 端到端验收与 README 截图。

## Tests

- `src/components/agent-switcher.test.tsx`、`src/routes/claude-accounts.test.tsx`、`src/components/claude-api-account-flow.test.tsx`：切换、渲染、对话框、阻断器、无 token 泄漏。
- **RED**: 组件/命令封装缺失时的渲染失败。

## Done

- [ ] Every task has RED/GREEN evidence and the node Gates pass.
- [ ] Artifact/evidence/status are updated in the execution map.
- [ ] Graph and semantic checks pass.

## STOP conditions

- 需要在前端保存 token 或密钥时停止。
- 需要修改 Codex 视图行为才能容纳 agent 切换时停止并回到设计。
- 后端命令缺失或契约变化导致 UI 无法按计划接线时停止并先更新上游节点。
