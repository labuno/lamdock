# APP-001-06: App 目标展示与连接切换

- **Todo ID**: APP-001-06
- **Execution Map**: docs/todos/APP-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/APP-001-app-slot-shared-auth-plan.md`（sha256 见 traceability.json）

## Outcome

PAT 模式下，概览与托盘显示 Codex App 当前用的帐号或连接；切换 ChatGPT 帐号时遇到外部连接会先确认并解除再切换；External API 帐号可一键接管 App；自定义连接时给出原因。每次切换后 App 都真正用上目标。

## Contract

- **Requirements**: `REQ-OBJ-02`, `REQ-SCP-02`, `REQ-IF-04`, `REQ-WP-04`, `REQ-TM-04`
- **Consumes**: `artifact:pat-switch-ui`, `artifact:app-target`
- **Produces**: `artifact:app-target-ui` — App 目标展示、解除连接后切换、External API 接管 App 的前端流程。
- **Gates**: `npm test -- src/App.handoff.test.tsx src/components/tray-quota-panel.test.tsx src/lib/app-target.test.ts`。
- **Boundaries**: Attach / Detach 只调用既有 `previewAttach` / `executeAttach` / `previewDetach` / `executeDetach`；不新增写 `config.toml` 的路径；Profile 模式界面不变；所有写操作前都有确认。

## Tasks

- [ ] `T01` 编写流程编排与界面测试并观察 RED。
  - **Test and RED**: `src/lib/app-target.test.ts` 覆盖编排函数：外部连接下切换帐号按 Detach 预览 → Detach 执行 → 切换 → 重启的顺序调用；Detach 失败时不调用切换；External API 接管按 Attach 预览（`profileId: 'main'`、该帐号的 provider 与模型）→ 执行 → 重启；自定义连接时返回原因而不调用任何写操作。`App.handoff.test.tsx` 与 `tray-quota-panel.test.tsx` 覆盖"Codex App: <名称>"展示、确认弹窗出现且取消时无调用、External API 卡片"Use in Codex App"与"In use"状态。实现前全部失败。
  - **Execution logic**: mock `api.getAppTarget` 与 provider store 的四个方法，断言调用顺序与参数。
  - **Files and responsibilities**: `src/lib/app-target.test.ts`、`src/App.handoff.test.tsx`、`src/components/tray-quota-panel.test.tsx`。
  - **Verification**: 运行 Gate 记录 RED。
  - **Artifact handoff**: 作为 T02、T03 的验收标准。
- [ ] `T02` 实现流程编排。
  - **Test and RED**: `app-target.test.ts` 用例。
  - **Execution logic**: `src/lib/app-target.ts` 提供 `appTargetLabel`、`switchAppToAccount`、`switchAppToProvider`，以依赖注入接收 API 与 provider store 方法；任一步失败即抛出并停止；Detach 成功但切换失败时错误信息说明 App 已回到 OpenAI。
  - **Files and responsibilities**: `src/lib/app-target.ts`。
  - **Verification**: 正常（两条流程）、错误（每一步失败）、边界（App 已在用该连接、目标为空帐号）。
  - **Artifact handoff**: 编排函数供 T03 使用。
- [ ] `T03` 接入主窗口与托盘。
  - **Test and RED**: T01 中界面用例。
  - **Execution logic**: 帐号 store 刷新时一并获取 App 目标；概览与托盘 PAT 模式显示目标行；`handleSwitchAccount` 与托盘 `switchTo` 改用编排函数，外部连接时先弹确认；External API 卡片在 PAT 模式下增加"Use in Codex App"；自定义连接时切换按钮禁用并给出原因。确认文案说明对话只读的影响。
  - **Files and responsibilities**: `src/stores/accounts.ts`、`src/App.tsx`、`src/routes/views.tsx`、`src/components/tray-quota-panel.tsx`。
  - **Verification**: Gate 通过；可访问性（确认弹窗有标题与按钮名称）。
  - **Artifact handoff**: 产出 `artifact:app-target-ui`，供 APP-001-04 验收。

## Tests

- `src/lib/app-target.test.ts`：编排顺序、失败停止、自定义连接无写操作。
- `App.handoff.test.tsx`、`tray-quota-panel.test.tsx`：目标展示、确认弹窗、External API 接管入口。
- **RED**: 实现前编排模块不存在、界面无目标行与新入口。

## Evidence（2026-11-10）

- **RED**：`app-target.test.ts` 因模块不存在无法解析；界面用例 8 个失败（无目标行、无"Use in Codex App"、切换未先解除连接）。
- **GREEN**：Gate 92 passed；全量 Vitest 322 passed；ESLint、`tsc --noEmit` 通过；改动文件 Prettier 通过。
- **实现偏差**：
  - 编排函数直接注入 `api` 的 Attach/Detach 函数，而不是 provider store 的方法，因为托盘窗口没有 provider store。确认弹窗沿用 `@tauri-apps/plugin-dialog`，失败时回退到 `window.confirm`。
  - 托盘里 External API 行在 PAT 模式下用"Use in Codex App"替代原来禁用的 Switch 按钮。
  - 主窗口里 App 当前接的连接对应的帐号，不再显示"已在使用"，可以直接切回。
  - 既有用例"confirms before reset"改为断言 Tauri 确认弹窗（本节点 mock 了该插件）。
- **Handoff**：APP-001-04 在真实 App 上验收三条路径：外部连接 → 帐号、帐号 → External API、自定义 `model_provider` 的禁用提示。

## Done

- [x] T01–T03 完成，Gate 通过，证据写入 execution-map。

## STOP conditions

- 既有 Attach / Detach 对 `main` 的预览被拒绝或需要新增后端写路径：停止，回到设计评审。
- 需要在 Profile 模式下也改变界面：停止，确认范围。
