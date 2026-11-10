# REL-001-08: 独立后续模块拆分

- **Todo ID**: REL-001-08
- **Execution Map**: execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: traceability.json 固定源文档 SHA-256；源码快照见 release-execution-scope.md。

## Outcome

独立后续模块拆分，遵守执行约束，不扩大产品范围。

## Contract

- **Requirements**: `REQ-C-06`, `REQ-C-01`, `REQ-08-01`, `REQ-08-02`, `REQ-08-03`, `REQ-08-04`
- **Produces**: `artifact:rel-001-08`
- **Gates**: `make check`
- **Boundaries**: 保留用户数据、现行契约和正式图标；真实环境验收与自动检查分别记录。

## Tasks

- [ ] `T01` 按职责逐个拆分大模块（独立后续交付）。
  - **Test and RED**: 每个职责迁移前运行其行为测试，纯迁移以公开导出和序列化不变为验收，不新增镜像测试。
  - **Execution logic**: 依次提取 provider_api_v2 的迁移恢复/Provider/API 帐号/绑定；views 按页面，App 按交互，CSS 按组件。每次只迁移一职责，保持可替换边界。
  - **Files and responsibilities**: provider_api_v2.rs、routes/views.tsx、App.tsx、styles.css 与既有对应行为测试；具体路径以职责命名。
  - **Verification**: 每步运行对应 Provider/帐号/会话/Handoff/界面套件，make check；不改变调度、删除、会话归属和 Agent 模型。
  - **Artifact handoff**: 贡献 `artifact:rel-001-08` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

## Tests

适用正常、空配置、错误及状态场景已在每项 Verification 中给出；纯文档、格式、死代码不扩大测试矩阵。

## Done

- [ ] 本节点任务及适用检查通过，真实证据写入 execution-map。
- [ ] 图谱与引用检查通过。

## STOP conditions

用户数据删除、公开行为改变、源文档 digest 漂移或必要环境不可用时记录具体阻碍；保留独立可做任务。
