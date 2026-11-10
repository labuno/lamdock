# REL-001-06: 整理文档与非运行工件

- **Todo ID**: REL-001-06
- **Execution Map**: execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: traceability.json 固定源文档 SHA-256；源码快照见 release-execution-scope.md。

## Outcome

整理文档与非运行工件，遵守执行约束，不扩大产品范围。

## Contract

- **Requirements**: `REQ-C-08`, `REQ-06-01`, `REQ-06-02`
- **Produces**: `artifact:rel-001-06`
- **Gates**: `node --test apps/desktop/scripts/*.test.mjs`
- **Boundaries**: 保留用户数据、现行契约和正式图标；真实环境验收与自动检查分别记录。

## Tasks

- [x] `T01` 归档过时记录、重复锁和历史设计工件。
  - **Test and RED**: 纯文档/确认未使用工件只做引用与一致性检查；先 rg Bun 和图标输入引用。
  - **Execution logic**: TODO 标记历史与现行入口；README 检查命令和下载说明同步；删除确认闲置 bun.lock；历史图标移至仓库外，保留正式来源和资源。
  - **Files and responsibilities**: README 中英文、DESKTOP-RUNTIME、TODO、bun.lock、output/icons 与仓库外归档清单。
  - **Verification**: 相对链接及执行图引用/digest；正式 master、tray 图标存在；品牌及打包脚本测试。
  - **Artifact handoff**: 贡献 `artifact:rel-001-06` 的上述可验证行为；后继在 Gate 通过后消费，状态见 map。

## Tests

适用正常、空配置、错误及状态场景已在每项 Verification 中给出；纯文档、格式、死代码不扩大测试矩阵。

## Done

- [x] 本节点任务及适用检查通过，真实证据写入 execution-map。
- [x] 图谱与引用检查通过。

## STOP conditions

用户数据删除、公开行为改变、源文档 digest 漂移或必要环境不可用时记录具体阻碍；保留独立可做任务。

## Evidence

2026-11-02：45 项 Node 测试、新增相对链接检查及 REL/CLD 图谱校验通过。TODO 原文保留在 docs/archive；当前入口区分现行、历史和退役能力。确认无 Bun 构建工作流后移除 bun.lock。31 个历史图标工件按路径和 SHA-256 移到仓库外；正式黑底图标与来源、菜单栏模板均保留。output/icons 从约 32 MB 降为 9.6 MB。归档位置见 output/icons/ARCHIVE.md。
