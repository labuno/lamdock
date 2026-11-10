# REL-001-03: 收敛旧 Provider 入口

- **Todo ID**: REL-001-03
- **Execution Map**: execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: traceability.json 固定源文档 SHA-256；源码快照见 release-execution-scope.md。

## Outcome

收敛旧 Provider 入口，遵守执行约束，不扩大产品范围。

## Contract

- **Requirements**: `REQ-C-01`, `REQ-03-01`, `REQ-03-02`, `REQ-03-03`
- **Produces**: `artifact:rel-001-03`
- **Gates**: `make check`
- **Boundaries**: 保留用户数据、现行契约和正式图标；真实环境验收与自动检查分别记录。

## Tasks

- [x] `T01` 删除无调用的旧命令并保留旧数据迁移。
  - **Test and RED**: 先审计 CLI/服务/契约/测试；用现有迁移和绑定测试作行为回归，未调用入口删除无新增行为 RED。
  - **Execution logic**: 删除 main 注册与 commands 的八个旧包装；服务仅删除无生产调用且非迁移所需函数，保留旧结构读取和必要内部调用；同步命令契约。
  - **Files and responsibilities**: main.rs、commands/mod.rs、services/provider.rs、05-tauri-command-contracts.md，现有 phase1/provider_legacy_contract/provider_phase4 测试。
  - **Verification**: 旧 providers.json 迁移到 V2；V2 创建修改绑定解绑及 API 帐号；测试不删除用户数据；全量检查。
  - **Artifact handoff**: 贡献 `artifact:rel-001-03` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

## Tests

适用正常、空配置、错误及状态场景已在每项 Verification 中给出；纯文档、格式、死代码不扩大测试矩阵。

## Done

- [x] 本节点任务及适用检查通过，真实证据写入 execution-map。
- [x] 图谱与引用检查通过。

## STOP conditions

用户数据删除、公开行为改变、源文档 digest 漂移或必要环境不可用时记录具体阻碍；保留独立可做任务。

## Evidence

2026-11-02：注册合同先 RED（legacy registration list_providers），再移除八个旧命令及旧写入实现；只保留旧数据 DTO 和只读 parser，旧 fixture 合同/V2 迁移不变。126 项聚焦测试及 make check 通过。
