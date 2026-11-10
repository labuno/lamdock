# REL-001-07: 打包与真实功能验收

- **Todo ID**: REL-001-07
- **Execution Map**: execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: traceability.json 固定源文档 SHA-256；源码快照见 release-execution-scope.md。

## Outcome

打包与真实功能验收，遵守执行约束，不扩大产品范围。

## Contract

- **Requirements**: `REQ-C-09`, `REQ-C-07`, `REQ-C-06`, `REQ-C-05`, `REQ-C-03`, `REQ-C-02`, `REQ-C-01`, `REQ-07-01`, `REQ-07-02`
- **Produces**: `artifact:rel-001-07`
- **Gates**: `make dmg`
- **Boundaries**: 保留用户数据、现行契约和正式图标；真实环境验收与自动检查分别记录。

## Tasks

- [ ] `T01` 验证真实帐号功能和启动恢复边界。
  - **Test and RED**: 真实功能不能用源码字符串测试代替；先运行 partial-delete recovery 临时目录回归，核对 web_search 已知限制。
  - **Execution logic**: 自动检查后用安装包验收启动/切换/会话/Handoff/API 帐号/代理/额度/Monitor/重启；真实帐号操作需可用 GUI，记录结果，失败明确报告。
  - **Files and responsibilities**: provider_phase4_api_account.rs 现有恢复用例；执行 evidence.md 记录 GUI 场景和支持的 Provider 协议。
  - **Verification**: 临时目录测试覆盖完整/部分删除恢复和幂等；Chat hosted 工具精确拒绝、原生 Responses 正常；GUI 各场景实测。
  - **Artifact handoff**: 贡献 `artifact:rel-001-07` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

- [x] `T02` 构建同一源码的 app 和 DMG 并记录版本哈希。
  - **Test and RED**: 版本合同 Node 测试先行；现有 package-gateway-components 测试与 verify 作为产物验收。
  - **Execution logic**: 固定来源快照/提交和版本，完整检查后 tauri:build、package:gateway-dmg，校验组件、架构和签名；可用身份时正式签名及适用公证。
  - **Files and responsibilities**: package-gateway-components.mjs 现有流程、evidence.md、清理后源码清单；不触发远端发布。
  - **Verification**: 挂载/卸载 DMG，验证 app 与三组件签名/manifest/hash；缺签名身份或真实 GUI 时不得宣称正式发布完成。
  - **Artifact handoff**: 贡献 `artifact:rel-001-07` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

## Tests

适用正常、空配置、错误及状态场景已在每项 Verification 中给出；纯文档、格式、死代码不扩大测试矩阵。

## Done

- [ ] 本节点任务及适用检查通过，真实证据写入 execution-map。
- [ ] 图谱与引用检查通过。

## STOP conditions

用户数据删除、公开行为改变、源文档 digest 漂移或必要环境不可用时记录具体阻碍；保留独立可做任务。

## Evidence

2026-11-02：`make dmg` 通过；应用/DMG 的签名及三组件版本/manifest/hash 校验通过，镜像已卸载。来源快照、哈希与剩余 GUI/正式分发条件见 [执行记录](../../release-cleanup-execution-report.md)。当前只完成 T02 的本地试用包验收，T01 真实帐号 GUI 未执行，节点不标完成。
