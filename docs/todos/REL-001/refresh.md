# REL-001-05: 复用集成刷新策略

- **Todo ID**: REL-001-05
- **Execution Map**: execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: traceability.json 固定源文档 SHA-256；源码快照见 release-execution-scope.md。

## Outcome

复用集成刷新策略，遵守执行约束，不扩大产品范围。

## Contract

- **Requirements**: `REQ-C-04`, `REQ-C-01`, `REQ-05-01`, `REQ-05-02`, `REQ-05-03`, `REQ-05-04`
- **Produces**: `artifact:rel-001-05`
- **Gates**: `make check`
- **Boundaries**: 保留用户数据、现行契约和正式图标；真实环境验收与自动检查分别记录。

## Tasks

- [x] `T01` 共享 Antigravity 加载与生命周期策略。
  - **Test and RED**: 先写 hooks/use-antigravity-quota.test.tsx：空端口不调用、启用即加载、定时刷新、离线恢复、重复刷新去重、配置切换/卸载忽略过期响应。
  - **Execution logic**: 以 number|null 端口和 Tauri 状态为输入；hook 持有本窗口请求/状态和两分钟 timer；主窗口与托盘消费；事件刷新复用 hook，后端缓存不动。
  - **Files and responsibilities**: 新 hook 与测试；App.tsx、tray-quota-panel.tsx 删除重复 state/ref/load；现有组件测试验证接线。
  - **Verification**: fake timers 验证两分钟、禁用清空状态、错误后下轮恢复、不交叉污染窗口；完整前端与 Rust 回归。
  - **Artifact handoff**: 贡献 `artifact:rel-001-05` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

## Tests

适用正常、空配置、错误及状态场景已在每项 Verification 中给出；纯文档、格式、死代码不扩大测试矩阵。

## Done

- [x] 本节点任务及适用检查通过，真实证据写入 execution-map。
- [x] 图谱与引用检查通过。

## STOP conditions

用户数据删除、公开行为改变、源文档 digest 漂移或必要环境不可用时记录具体阻碍；保留独立可做任务。

## Evidence

2026-11-02：新增 hook 测试先 RED（模块缺失），再共享加载/去重/timer/过期响应处理。主窗口消费现有端口状态；托盘独立读取后端端口配置，仍复用后端缓存；空配置不请求 quota，已配置离线保持刷新。7 项 hook 及 52 项组件/App 聚焦测试通过；完整 make check 通过。
