# 发布清理执行记录（2026-11-02）

本轮先恢复检查，再做依赖、旧入口和刷新清理；大模块拆分保留为独立后续任务。
执行状态与依赖见 [REL-001 执行图](todos/REL-001/execution-map.json)，
范围调整见 [执行约束](release-execution-scope.md)。

## 已验证的变更

- 修复 Rust 可选 token 字段旧断言；删除无断言的开发机连接探针。
  手工投影修复移到 `src-tauri/examples/repair-auth-projections.rs`，必须显式提供 home。
- `make check`、CI 和 Release 共用构建、Vitest、ESLint、Node 脚本、UI smoke、
  Rust fmt、Clippy 和完整 Rust 测试。版本、标签或手动输入不一致时停止；打包不改写版本。
  分支手动构建只上传工件，版本标签才发布。
- 移除 `image`、`futures`、`tower`、`tower-http` 四个直接依赖，Cargo.lock 减少 52 个包。
  `rav1e` 已退出依赖树；Tauri PNG 支持、所有正式图标及菜单栏资源保持不变。
- 移除旧 Provider 八个 Tauri 操作入口与旧写入实现，保留历史数据 DTO、读取合同及 V2 迁移。
  V2 Provider、绑定与 API 帐号能力保留；未删除用户配置或凭据。
- 删除计划列出的七个闲置前端封装、`planTypeLabel` 及专用闲置类型/测试。
  Rust 迁移、分页会话、PAT 导入继续保留；删除退役的 `activityTokens/activity_tokens` DTO 字段。
- 主窗口和托盘复用 `useAntigravityQuota`。空端口不请求 quota，已配置离线继续刷新；
  配置变化和卸载使旧响应失效。每个 WebView 独立持有请求状态，继续由后端缓存协调。
  托盘在刷新事件和正常周期重新读取配置，不依赖主窗口可见性。
- 历史 TODO 流水已在后续清理中移出仓库，未完成验收统一保留到 [当前手工验收](manual-acceptance.md)，
  Usage 和整帐号 Sync 标为退役。README 对齐当前仓库、实际构建方式及检查命令；
  移除已无工作流使用的 `bun.lock`。
- 31 个历史图标工件移至仓库外，带原路径和 SHA-256 清单，详见
  [图标归档记录](../output/icons/ARCHIVE.md)。`output/icons` 从约 32 MB 降为 9.6 MB，
  55 个正式图标文件和界面 PNG 与清理前逐文件哈希一致。

## 自动验证

| 检查 | 结果 |
| --- | --- |
| `make check` | 通过：前端构建、266 项 Vitest（27 文件）、ESLint、45 项 Node、UI smoke、Rust fmt、Clippy、完整 Rust 测试 |
| 完整 Rust 套件 | 564 项通过；1 项原有手动 RSS 探针忽略；包含真实 sidecar + 模拟 Codex/上游进程联动 |
| Provider/历史合同/API 帐号/phase1 聚焦套件 | 126 项通过 |
| hook/主窗口/托盘聚焦套件 | 59 项通过，其中 7 项新增 hook 测试 |
| `tsc --noEmit --noUnusedLocals --noUnusedParameters` | 通过 |
| 手工修复工具 | 不传 home 明确报 usage；显式传入空临时 home 返回零修复，未访问真实 HOME |
| REL-001 / CLD-001 图谱、追溯校验 | 通过，CLD 源文档与追溯未改动 |
| CI/Release YAML 解析、新增相对链接 | 通过；未在远端执行工作流 |
| 应用/DMG 构建 | 通过；只读挂载、应用及三个组件签名/版本/哈希校验通过，镜像已卸载 |

测试先行证据：Rust E0308 与 rustfmt 为原有 RED；旧命令注册合同先报
`legacy registration list_providers`；额度字段序列化测试先因仍返回 `activityTokens` 失败；
版本校验器及刷新 hook 测试先因模块缺失失败。之后实现并完成上述 GREEN/回归。
纯格式、确认死代码、文档和归档只做相应一致性检查及现有回归。

## 源码与验证来源

- 清理前源码快照及 500 文件哈希：见 [执行约束](release-execution-scope.md)。
- 清理后构建输入（340 文件）与测试原始日志：
  `/Users/zhanhd/Documents/products/github/lamdock-release-evidence-20261102-142129`。
- `build-inputs.tar.gz` SHA-256：
  `d441eb872176e5bf49433333864151271d4fc977cd39289957ac5794f1499c74`。
- 仓库仍无 Git 提交；本次以源码快照关联本地产物，没有提交、推送、创建标签或发布 Release。
  正式发布前仍需把最终版本提交并让标签指向该提交。

## 尚未完成

- 真实帐号 GUI 验收：cmux Computer Use 初始化未完成。现有旧 LAM 正在运行，
  新项目保留同一应用标识和默认数据目录，本轮未启动共享真实数据的新实例，也未替换或重启旧 LAM。
  后续先用独立 `LAM_HOME` 做隔离验证，再安排真实帐号验收。
- API 帐号部分删除的启动恢复：已有临时目录测试验证保留运行时重建目录、不重新绑定、
  清理独占 Provider、第二次恢复零工作；完整帐号中断删除仍能恢复绑定。
  原专题计划仅剩安装包启动验收，自动测试通过不等同 GUI 验收完成。
- Chat Provider 的 hosted `web_search` 仍受上游能力合同限制：保持明确错误，不伪造搜索或静默删除工具。
  真实 Gateway 验收须记录所选协议和工具支持范围，详见 [工具桥接边界](todo-fix-gateway-chat-tool-namespace-bridge.md)。
- 正式签名、公证与正式发布记录待目标分发身份落实；本轮只验证 Apple Silicon 本地试用包。
- Provider 服务、页面编排及样式的大文件职责拆分已独立为 `REL-001-08`，不阻塞本轮清理和本地包验证。

## 首轮清理工件（历史记录）

| 项目 | 结果 |
| --- | --- |
| 应用 | `apps/desktop/src-tauri/target/release/bundle/macos/LamDock.app`，约 38 MB |
| DMG | `apps/desktop/src-tauri/target/release/bundle/dmg/LamDock_0.4.4_aarch64.dmg` |
| 大小 | 18559460 字节，约 18.6 MB |
| SHA-256 | `f94197e790841ce89e5665a2e095031f10076214b23ef0edd3b435cba5095568` |
| 架构与签名 | arm64 / Apple Silicon；ad-hoc 本地试用签名 |
| 随包组件 | `lam`、`lam-provider-gateway`、`lam-auth-helper`，版本均为 0.4.4 |
| 来源一致性 | 打包后 340 个构建输入与保存快照逐文件 SHA-256 一致 |

验证日志与 `artifacts.json` 已保存到上方仓库外证据目录。打包完成未启动新实例；
正在运行的 `/Applications/LAM.app` 未被替换或重启。真实帐号验收、正式签名公证、
Git 提交/标签和远端 Release 均不因本地产物通过而视为完成。

## 历史任务清理（后续文档维护）

用户要求清理历史 TODO 后，移除了 21 份已完成实施流水、过时 Phase 0/1 清单及旧计划。
真实帐号、ChatGPT 重启、Antigravity 设置与实时刷新等未完成验收并入
[当前手工验收](manual-acceptance.md)，状态仍为待验证。
现行专题设计、Claude 执行追溯、发布执行图及未关闭的专题任务保留。

本次只修改文档和文档引用，未修改产品源码或已有安装包。
清理前原文与逐文件哈希保存在仓库外：
`/Users/zhanhd/Documents/products/github/lamdock-todo-cleanup-20261102-143805`。

文档清理验证：135 个相对文件链接有效，已删除路径无残留引用，REL-001 / CLD-001
执行图及语义追溯校验通过，340 个产品构建输入与上轮打包快照完全一致。

## 当前工件：安装包排除 lam-core

用户确认后，仅调整打包脚本：应用 finalize 在重新签名之前移除开发诊断工具 lam-core，
DMG 生成及挂载校验拒绝夹带该文件的应用。Cargo 目标和 make accounts 保持不变，
未做符号裁剪、编译优化或 UI/业务逻辑变更。上方历史工件路径已被本次构建覆盖。

48 项 Node 脚本测试通过（包含新增临时应用包集成测试）；make accounts 在隔离 home 下正常运行。
make dmg 完整通过，挂载校验确认主程序和三个运行时组件存在、lam-core 不存在，
签名与组件哈希有效，镜像已卸载。前端源码和包内 Resources 哈希与修改前一致。

| 项目 | 当前结果 |
| --- | --- |
| DMG | `apps/desktop/src-tauri/target/release/bundle/dmg/LamDock_0.4.4_aarch64.dmg` |
| 大小 | 18077611 字节（约 18.08 MB），原为 18559460 字节 |
| 减少 | 481849 字节，约 0.48 MB（2.60%） |
| SHA-256 | `60ca10468cd6047b8a55b78a7c08b62c43e91956930fd511abead3a1f37bfaaa` |
| 来源快照 SHA-256 | `425a97734e5d3ad1e3762d5c4b84302f37fadc905c71371ca60e71ac6dc9d2d1` |

构建输入、原始日志及前后比较保存在仓库外 `/Users/zhanhd/Documents/products/github/lamdock-exclude-lam-core-20261102-145428`。
具体测试合同见 [本次打包任务](todo-exclude-lam-core.md)。
真实帐号 GUI、正式签名公证和正式发布仍未执行，正在运行的旧 LAM 未替换或重启。
