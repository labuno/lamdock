# REL-001-02: 移除无用直接依赖

- **Todo ID**: REL-001-02
- **Execution Map**: execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: traceability.json 固定源文档 SHA-256；源码快照见 release-execution-scope.md。

## Outcome

移除无用直接依赖，遵守执行约束，不扩大产品范围。

## Contract

- **Requirements**: `REQ-02-01`, `REQ-02-02`, `REQ-02-03`
- **Produces**: `artifact:rel-001-02`
- **Gates**: `cargo check --offline -j 2`
- **Boundaries**: 保留用户数据、现行契约和正式图标；真实环境验收与自动检查分别记录。

## Tasks

- [x] `T01` 移除已确认闲置构建及运行依赖。
  - **Test and RED**: 现有 cargo tree -e features 与 rg 审计提供删除前证据；死依赖无行为 RED。
  - **Execution logic**: 审计 image/futures/tower/tower-http 引用和特性；仅移除无直接用途依赖，Cargo 更新锁文件；保留 Tauri image-png。
  - **Files and responsibilities**: Cargo.toml、Cargo.lock、build.rs（只读）：声明和特性。
  - **Verification**: cargo check --offline -j 2；cargo test；最终应用打包及组件清单验证；不承诺传递 crate 消失。
  - **Artifact handoff**: 贡献 `artifact:rel-001-02` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

## Tests

适用正常、空配置、错误及状态场景已在每项 Verification 中给出；纯文档、格式、死代码不扩大测试矩阵。

## Done

- [x] 本节点任务及适用检查通过，真实证据写入 execution-map。
- [x] 图谱与引用检查通过。

## STOP conditions

用户数据删除、公开行为改变、源文档 digest 漂移或必要环境不可用时记录具体阻碍；保留独立可做任务。

## Evidence

2026-11-02：删除 image/futures/tower/tower-http 四个直接依赖，Cargo.lock 同步；源码/测试引用审计无直接使用。cargo check 与 make check 通过；cargo tree -i rav1e 已无匹配，tower/tower-http 作为传递依赖保留。
