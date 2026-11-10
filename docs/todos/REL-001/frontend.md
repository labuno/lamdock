# REL-001-04: 清理闲置前端封装

- **Todo ID**: REL-001-04
- **Execution Map**: execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: traceability.json 固定源文档 SHA-256；源码快照见 release-execution-scope.md。

## Outcome

清理闲置前端封装，遵守执行约束，不扩大产品范围。

## Contract

- **Requirements**: `REQ-C-09`, `REQ-C-01`, `REQ-04-01`, `REQ-04-02`, `REQ-04-03`, `REQ-04-04`
- **Produces**: `artifact:rel-001-04`
- **Gates**: `make check`
- **Boundaries**: 保留用户数据、现行契约和正式图标；真实环境验收与自动检查分别记录。

## Tasks

- [x] `T01` 删掉无生产调用方封装与退役 DTO。
  - **Test and RED**: rg 审计模块内、跨模块和动态引用；保留分页会话及帐号导入行为测试，死代码删除无 RED。
  - **Execution logic**: 删除计划列出七个封装、planTypeLabel 和退役 activityTokens；同步 DTO 投影和测试 fixture，不删 Rust 迁移/PAT 能力。
  - **Files and responsibilities**: lib/api.ts、lib/quota.ts、lib/types.ts 及其调用方测试；Rust quota DTO 以既有序列化测试映射。
  - **Verification**: TypeScript build、Vitest、Node smoke；分页加载、帐号导入和 Handoff 回归。
  - **Artifact handoff**: 贡献 `artifact:rel-001-04` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

## Tests

适用正常、空配置、错误及状态场景已在每项 Verification 中给出；纯文档、格式、死代码不扩大测试矩阵。

## Done

- [x] 本节点任务及适用检查通过，真实证据写入 execution-map。
- [x] 图谱与引用检查通过。

## STOP conditions

用户数据删除、公开行为改变、源文档 digest 漂移或必要环境不可用时记录具体阻碍；保留独立可做任务。

## Evidence

2026-11-02：已移除七个闲置 API 封装、planTypeLabel 与只服务于封装的类型/测试；历史 Provider DTO 仍由 legacy-provider-contract fixture 使用，保留。分页/Handoff 测试改为本地 sessionItems fixture；退役 activityTokens 的序列化断言先 RED，再移除字段。完整 Vitest 266 项通过。
