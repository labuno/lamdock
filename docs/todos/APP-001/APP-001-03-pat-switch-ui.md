# APP-001-03: PAT 模式切换按钮可用性与文案

- **Todo ID**: APP-001-03
- **Execution Map**: docs/todos/APP-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/APP-001-app-slot-shared-auth-plan.md`（sha256 见 traceability.json）

## Outcome

主窗口与托盘在 PAT 模式下只对能接管 Codex App 的帐号提供可点击的切换；不可切换的帐号给出原因提示；切换成功文案说明 App 已改用该帐号。

## Contract

- **Requirements**: `REQ-OBJ-01`, `REQ-SCP-01`, `REQ-IF-01`, `REQ-WP-02`, `REQ-TM-02`
- **Consumes**: `artifact:app-slot-link`
- **Produces**: `artifact:pat-switch-ui` — PAT 模式按钮状态与文案。
- **Gates**: `npm test -- src/components/tray-quota-panel.test.tsx src/App.handoff.test.tsx`。
- **Boundaries**: 不改变 Profile 模式按钮；模式切换不调用凭据操作；不新增后端命令。

## Tasks

- [x] `T01` 编写按钮状态测试并观察 RED。
  - **Test and RED**: 主窗口（`App.handoff.test.tsx`）与托盘（`tray-quota-panel.test.tsx`）各覆盖四种帐号：无凭据（禁用，提示需先登录）、API 帐号（无切换或禁用，提示不支持）、main（禁用）、当前帐号（禁用，显示 Active）；可切换帐号点击后调用 `switchToPatAccount` 再 `restartChatgpt`。现状下无凭据、API、托盘 main 用例失败。
  - **Execution logic**: 使用现有 mock 帐号工厂，设置 `hasAuth`、`authMode`、API 绑定。
  - **Files and responsibilities**: `apps/desktop/src/App.handoff.test.tsx`、`apps/desktop/src/components/tray-quota-panel.test.tsx`。
  - **Verification**: 运行 Gate 命令记录 RED。
  - **Artifact handoff**: 作为 T02 的验收标准。
- [x] `T02` 实现按钮可用性与文案。
  - **Test and RED**: T01 用例。
  - **Execution logic**: 抽出一个判定函数返回"可切换 / 原因"，主窗口和托盘共用；`views.tsx` PAT 分支按其禁用并设置 `title`；托盘 PAT 模式同样处理并对 main 禁用；`App.tsx` 与托盘的成功文案改为 "Codex App now uses <帐号>. Restarting ChatGPT…"。
  - **Files and responsibilities**: `apps/desktop/src/lib/auth.ts`（判定函数）、`apps/desktop/src/routes/views.tsx`、`apps/desktop/src/components/tray-quota-panel.tsx`、`apps/desktop/src/App.tsx`。
  - **Verification**: 正常（可切换帐号）、错误（后端报错时保留现有错误展示）、边界（四种不可切换帐号）、可访问性（`aria-label` 与 `title` 一致）。
  - **Artifact handoff**: 产出 `artifact:pat-switch-ui`，供 APP-001-04 验收。

## Tests

- `App.handoff.test.tsx`、`tray-quota-panel.test.tsx`：四种不可切换帐号与一个可切换帐号。
- **RED**: 现状无凭据和 API 帐号按钮可点击，托盘 main 可点击。

## Evidence（2026-11-10）

- **RED**：新增 7 例全部失败（`codexAppSwitchBlocker` 不存在；主窗口无凭据、API Key 帐号按钮可点击；托盘 main、无凭据、API Key、External API 帐号可点击；成功文案仍为旧文案）。
- **GREEN**：Gate 3 个测试文件 76 passed；全量 Vitest 29 文件 301 passed；ESLint、`tsc --noEmit`、Prettier 通过。
- **实现说明**：判定函数 `codexAppSwitchBlocker` 位于 `src/lib/auth.ts`，主窗口与托盘共用；原因写入按钮 `title`。External API 帐号的原因文案在 APP-001-06 中随"Use in Codex App"入口一起调整。

## Done

- [x] T01–T02 完成，Gate 通过，证据写入 execution-map。

## STOP conditions

- 需要新增后端字段才能区分 API 帐号：停止，回到设计评审确认接口变化。
