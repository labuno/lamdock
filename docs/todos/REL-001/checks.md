# REL-001-01: 恢复发布检查

- **Todo ID**: REL-001-01
- **Execution Map**: execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: traceability.json 固定源文档 SHA-256；源码快照见 release-execution-scope.md。

## Outcome

恢复发布检查，遵守执行约束，不扩大产品范围。

## Contract

- **Requirements**: `REQ-C-03`, `REQ-01-01`, `REQ-01-02`
- **Produces**: `artifact:rel-001-01`
- **Gates**: `make check`
- **Boundaries**: 保留用户数据、现行契约和正式图标；真实环境验收与自动检查分别记录。

## Tasks

- [x] `T01` 隔离机器诊断并修复 Rust 测试基线。
  - **Test and RED**: 现有 provider_phase3_g4 编译报 E0308；cargo fmt -- --check 失败。默认测试探针源码检查确认硬编码真实路径。
  - **Execution logic**: 删除无断言连接探针；把手工修复测试移至必须显式提供 home 的 example；旧用量断言改为 Some(5)，不改业务 DTO。
  - **Files and responsibilities**: tests/provider_phase3_g4.rs、provider_auth_runtime.rs 和 examples：测试基线与手工诊断边界。
  - **Verification**: cargo test --offline -j 2；cargo fmt -- --check；所有隔离测试使用临时目录。
  - **Artifact handoff**: 贡献 `artifact:rel-001-01` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

- [x] `T02` 复用必要检查并校验发布版本。
  - **Test and RED**: 先新增 Node release-readiness.test.mjs，用临时仓库验证版本一致/不一致及失败检查中止；现有流程缺少 lint、Node 测试和 Rust fmt。
  - **Execution logic**: make check 统一 build/Vitest/lint/Node/UI/fmt/Clippy/Rust test；CI 和 Release 调用相同入口。Release 不同步版本；只从匹配源码版本的 tag 发布。
  - **Files and responsibilities**: Makefile、ci.yml、release.yml、release-metadata.mjs 及映射 Node 测试：检查入口与版本边界。
  - **Verification**: Node 测试覆盖正常标签、错误标签、版本冲突、缺少版本和失败检查后不执行打包；make check。
  - **Artifact handoff**: 贡献 `artifact:rel-001-01` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

## Tests

适用正常、空配置、错误及状态场景已在每项 Verification 中给出；纯文档、格式、死代码不扩大测试矩阵。

## Done

- [x] 本节点任务及适用检查通过，真实证据写入 execution-map。
- [x] 图谱与引用检查通过。

## STOP conditions

用户数据删除、公开行为改变、源文档 digest 漂移或必要环境不可用时记录具体阻碍；保留独立可做任务。

## Evidence

2026-11-02：RED 为现有 E0308 与 rustfmt 差异，以及新增版本校验器缺失。GREEN：10 项 release-readiness Node 测试通过；make check 完整通过（26 文件 266 项 Vitest、45 项 Node、Rust 全套）。默认 probe 删除；手工修复 example 必须显式传入 home。原始日志 /tmp/lamdock-check-initial.log。
