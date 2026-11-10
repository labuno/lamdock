# LamDock 发布检查与精简计划

审查日期：2026-11-02。代码版本：0.4.4。实施状态：执行中。

当前项目可以生成供本机试用的 Apple Silicon 安装包，但尚未完成正式发布验收。
精简重点是多余依赖、历史操作入口、重复刷新逻辑和失效文档；帐号管理、Handoff、
API/Gateway、独立代理、官方额度及 Gateway Monitor 继续保留。

本页的打包结果和实测表保留清理前审查快照；清理后的验证、工件和剩余验收见
[发布清理执行记录](release-cleanup-execution-report.md)。大模块拆分已独立为后续工作。

## 当前打包结果

2026-11-02 已实际完成 `.app` 和 DMG 构建，产物如下：

| 项目       | 结果                                                                         |
| ---------- | ---------------------------------------------------------------------------- |
| 应用       | `apps/desktop/src-tauri/target/release/bundle/macos/LamDock.app`，约 38 MB   |
| 安装包     | `apps/desktop/src-tauri/target/release/bundle/dmg/LamDock_0.4.4_aarch64.dmg` |
| 安装包大小 | 18,598,843 字节，约 18.6 MB                                                  |
| SHA-256    | `832764568e0d65a9767a8d8fc57f61e46f2c877d990b8aaa339ae86f1e988bd5`           |
| 架构与签名 | Apple Silicon arm64，ad-hoc 临时签名                                         |
| 打包验证   | DMG 只读挂载、应用及子组件签名、三个组件的清单哈希校验通过；验证后已卸载镜像 |

三个随包组件为 `lam`、`lam-provider-gateway`、`lam-auth-helper`，版本均为 0.4.4。
以上路径是本机构建产物，清理 `target` 后需要重新生成；哈希仅对应本次安装包。

使用前仍需安装官方 Codex CLI。本次未完成真实帐号下的 GUI 验收，临时签名和组件
校验通过也不代表已经完成正式签名、公证或其他架构的发布验证。

## 已执行的验证

下表记录 2026-11-02 审查时的实测结果，不代表下方修复与清理任务已经完成。
前端命令在 `apps/desktop` 执行，Rust 命令在 `apps/desktop/src-tauri` 执行。

| 验证命令                                                                               | 结果与范围                                                                         |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `npm run build`                                                                        | 通过，TypeScript 与 Vite 构建成功                                                  |
| `npm test -- --maxWorkers=2`                                                           | 26 个文件、266 项测试通过                                                          |
| `npm run lint`                                                                         | 通过                                                                               |
| `node node_modules/typescript/bin/tsc --noEmit --noUnusedLocals --noUnusedParameters`  | 通过；不等同于所有导出都有生产调用方                                               |
| `node --test scripts/*.test.mjs`                                                       | 35 项测试通过                                                                      |
| `node scripts/ui-smoke.mjs`                                                            | 通过；该脚本检查源码字符串，不是 GUI 操作验收                                      |
| `cargo clippy --offline -- -D warnings`                                                | 通过，范围为该命令默认检查的目标                                                   |
| `cargo fmt -- --check`                                                                 | 失败，`provider_auth_runtime.rs` 有格式差异                                        |
| `cargo test --offline`                                                                 | 编译失败，`provider_phase3_g4.rs` 的旧断言与可选字段类型不匹配；完整测试套件未通过 |
| `cargo test --offline -j 2 --lib --bins`                                               | 67 项库测试及 3 项主程序测试通过                                                   |
| 下述四个集成测试目标                                                                   | 共 16 项测试通过                                                                   |
| `CARGO_NET_OFFLINE=true CARGO_BUILD_JOBS=2 LAM_CODESIGN_IDENTITY= npm run tauri:build` | `.app` 构建及签名校验通过                                                          |
| `npm run package:gateway-dmg`                                                          | DMG 生成、挂载及完整性校验通过                                                     |

四个集成测试目标的实际执行命令：

```bash
cargo test --offline -j 2 \
  --test provider_phase3_process_g4 \
  --test provider_gateway_launcher \
  --test provider_gateway_monitor \
  --test request_monitor \
  -- --test-threads=1
```

其中进程联动测试运行了真实启动器、网关和认证助手，使用临时目录、模拟 Codex
和模拟上游，不代表真实帐号端到端验证。

首次高并发前端测试出现 14 项超时，限制为两个 worker 后全部通过，不登记为已确认的
业务缺陷。Rust 本地端口测试及 DMG 操作在解除沙箱限制后通过，环境权限错误也不登记
为代码缺陷。

## 发布前需要修复的问题

### Rust 完整测试无法编译

证据：[provider_phase3_g4.rs](../apps/desktop/src-tauri/tests/provider_phase3_g4.rs)
中的断言仍为 `assert_eq!(text_metric.usage.as_ref().unwrap().total_tokens, 5)`，
而 `total_tokens` 已改为 `Option<u64>`，导致 E0308 类型不匹配。

以现有编译失败作为修复起点，让测试表达“该响应返回了已知的 5 个 token”，并保留
缺失用量为未知的约定。不要为迁就旧测试把业务字段恢复成必填值或把缺失值补成零。
修复后必须运行完整 Rust 测试，不能只运行已经通过的库测试。

### Rust 格式检查失败

[provider_auth_runtime.rs](../apps/desktop/src-tauri/tests/provider_auth_runtime.rs)
中 `repair_developer_stale_codex_auth_projections` 的调用换行不符合 rustfmt。
这是格式问题，不需要新增行为测试。还应在清理开发机诊断代码时评估该手工修复测试的落点。

### 本地检查与发布检查不一致

- [Makefile](../Makefile) 的 `make check` 包含构建、静态 UI smoke、Rust 格式、Clippy
  和 Rust 测试，但没有 Vitest、ESLint、Node 脚本测试。
- [CI](../.github/workflows/ci.yml) 执行前端构建、Vitest、`cargo check` 和 `cargo test`，
  没有覆盖本地检查中的全部项目。
- [Release](../.github/workflows/release.yml) 直接打包并发布，没有以同一源码修订的
  完整检查通过为前提。
- README 对 `make check` 的描述与实际命令不一致；[桌面运行指南](DESKTOP-RUNTIME.md)
  已明确说明需要另外运行 Vitest。

将现有检查收敛为可复用入口，让本地、CI 和发布流程使用相同的必要检查。
同一发布修订必须先检查通过，再打包、验证和发布，不另外建设发布平台。

### 源码缺少可追溯基线

审查时 `git status --short --branch` 显示 `No commits yet on main`，所有项目文件均为
未跟踪状态。当前安装包来源于本地工作目录，尚不能关联到一个 Git 提交。

代码清理前应保存可比较的源码基线；正式交付前形成能对应源码、版本和安装包的版本记录。
不能用空的 `git diff` 证明未跟踪源码没有变化。

## 精简范围

### 移除多余的直接依赖

[Cargo.toml](../apps/desktop/src-tauri/Cargo.toml) 的构建依赖包含 `image = "0.25"`，
而 [build.rs](../apps/desktop/src-tauri/build.rs) 仅调用 `tauri_build::build()`。
实际依赖树为 `image → ravif → rav1e`，本次首次 release 构建也编译了这些图像编码依赖。

优先移除未使用的构建依赖 `image`；对未发现源码、测试直接引用的 `futures`、`tower`、
`tower-http` 逐项确认特性影响后移除，并更新 Cargo 锁文件。保留 Tauri 的 PNG 支持、
正式图标及图标生成链。间接依赖可能仍被其他库使用，不能承诺这些 crate 全部从依赖树消失。

验收：Rust 构建、相关测试和打包继续通过；项目自身不再以构建依赖启用无用的图像编码器。

### 收敛旧版 Provider 操作入口

当前界面使用 V2，但 [main.rs](../apps/desktop/src-tauri/src/main.rs) 仍注册旧版列表、
创建、更新、删除、测试和绑定等八个命令。
[provider.rs](../apps/desktop/src-tauri/src/services/provider.rs) 操作
`~/.lam/config/providers.json`，V2 则使用 `~/.lam/provider-hub/providers.json`。

先核对界面、CLI、内部服务及命令契约的调用方，再删除没有实际调用方的旧操作入口和实现。
旧数据解析、必要的 V2 迁移与现有用户配置仍需保留；不能因为旧 CRUD 不再使用而删除
用户的 Provider、凭证或绑定数据。

验收：保留的操作统一进入 V2；旧数据仍能迁移；Provider 创建、修改、绑定、解绑及
API 帐号流程的相关测试通过，命令契约同步更新。

### 清理开发机探针和无生产调用方的封装

`tests/probe_connection.rs`（已删除，以下为审查时证据）写死
`/Users/zhanhd`，读取真实开发机的 `cmd` 帐号，且成功与失败均只打印日志，没有断言。
将其从自动测试中移除；如仍有诊断用途，改为显式传入路径的手工工具。
其他读取真实 HOME 的手工诊断测试也应与默认自动测试分开。

[api.ts](../apps/desktop/src/lib/api.ts) 中以下导出在非测试源码中未发现调用方：
`listSessions`、`refreshAllQuotas`、`createProviderLegacyCompatV2`、
`planGatewayPortMigrationV2`、`executeGatewayPortMigrationV2`、`uploadPatCredentials`、
`getPatMetadata`。另外，[quota.ts](../apps/desktop/src/lib/quota.ts) 的 `planTypeLabel`
只发现定义和测试引用；退役 Usage 的 `activityTokens/activity_tokens` 字段仍残留在配额 DTO 中。

逐项确认后删除闲置前端封装、类型和仅验证已删除函数的测试。前端封装无调用方不代表
对应 Rust 能力、迁移合同或 CLI 能力也可以删除。模块内引用、图标映射等动态选择也必须
计入引用检查，不能只根据“没有跨文件引用”判断死代码。

验收：默认测试只使用隔离数据；界面实际需要的入口、分页会话与帐号导入继续工作；
TypeScript 检查及相关行为测试通过。

### 合并重复刷新逻辑并拆分过大的模块

[App.tsx](../apps/desktop/src/App.tsx) 与
[tray-quota-panel.tsx](../apps/desktop/src/components/tray-quota-panel.tsx) 各有
Antigravity 初始化和两分钟刷新逻辑，未配置集成时也会调用查询。后端已有缓存，
因此不能据此直接推断真实上游请求翻倍，但前端刷新策略和状态维护存在重复。

复用获取策略、过滤和展示选择器；未配置 Antigravity 时跳过无意义轮询。主窗口与托盘是
不同 WebView，应复用现有后端缓存协调，不能假设导入同一个前端 store 就能跨窗口共享状态。
主窗口隐藏后，菜单栏仍需正常刷新；保持现有取消、去重和资源释放行为，不新增通用调度系统。

以下文件还应按实际职责逐步拆分，行数本身不作为删除依据：

| 文件                                        | 审查时行数 | 拆分方向                               |
| ------------------------------------------- | ---------- | -------------------------------------- |
| `src-tauri/src/services/provider_api_v2.rs` | 5,006      | Provider、API 帐号、迁移恢复、绑定操作 |
| `src/routes/views.tsx`                      | 2,325      | 帐号、会话、设置页面                   |
| `src/App.tsx`                               | 1,832      | 页面编排与各功能交互                   |
| `src/styles.css`                            | 4,915      | 按现有组件职责整理样式                 |

上表路径以 `apps/desktop` 为根。拆分应在行为修复后进行，一次迁移一个职责，不同时改变
网关调度、会话归属、帐号删除或 Handoff 语义，也不为未来 Agent 提前增加抽象层。

### 整理文档与非运行工件

- 历史 TODO 实施流水已清理；[当前任务入口](TODO.md) 与 [手工验收](manual-acceptance.md)
  保留现行任务及未完成的真实验收。Usage 和整帐号 Sync 不恢复为待实现功能。
- README 的下载入口仍指向旧 LAM 0.4.0，后续按实际发布版本和仓库更新，不能把本次
  本机安装包写成已发布的 GitHub Release。
- CI 与构建统一使用 npm，`bun.lock` 与当前 `package.json` 已有差异。确认没有 Bun
  工作流后移除该锁文件，保留 `package-lock.json` 和 `Cargo.lock`。
- `output/icons` 约 32 MB，包含历史设计图、压缩包和备份。将非运行工件归档到源码仓库外，
  保留正式 master、应用图标、菜单栏模板及必要的设计来源；这主要减少源码仓库体积。
- 保留 [Claude 多 Agent 计划](CLD-001-claude-agent-support-plan.md) 及尚有效的执行追溯。
  归档或改写计划前检查引用和摘要，不能让执行图指向被删除或未经同步修改的源文件。

验收：文档入口指向当前说明，未完成验收仍可找到；相对文件链接及执行追溯一致；
正式图标和运行时资源不受归档影响。

## 执行顺序与验收

执行进度见 [执行记录](release-cleanup-execution-report.md) 和 [执行图](todos/REL-001/execution-map.json)。
下方勾选反映本轮进度；行为修复先使用现有失败测试或补充必要的行为测试，再实施并回归；
纯格式、文档和已确认死代码删除使用对应一致性检查及现有回归，不补造测试矩阵。

### 第一阶段 恢复发布检查

- [x] 建立可比较的源码基线，记录当前版本与工作目录状态。
- [x] 修复 `provider_phase3_g4.rs` 类型断言和 rustfmt 差异，运行完整 Rust 测试。
- [x] 移出开发机探针，确保默认测试不读取真实帐号数据。
- [x] 统一本地、CI 和 Release 的必要检查，确认失败时不会继续发布。

完成条件：完整检查通过，默认测试与开发机数据隔离；本地检查命令的文档与实际行为一致。

### 第二阶段 移除多余依赖和闲置入口

- [x] 移除无用直接依赖并更新 Cargo 锁文件，验证依赖特性与构建。
- [x] 核对旧 Provider 调用方，移除闲置操作，保留必要迁移。
- [x] 清理无生产调用方的前端封装及相关残留类型和测试。

完成条件：相关行为回归及完整检查通过；重新构建应用并验证随包组件完整性。

### 第三阶段 收敛刷新和模块职责

- [x] 复用刷新策略，跳过未配置集成的轮询，验证主窗口与托盘的刷新、去重和卸载清理。
- [ ] 按实际职责逐个拆分大文件，每一步保持公开行为与序列化合同一致。（独立后续任务，不阻塞本轮发布检查。）

完成条件：主窗口、托盘、帐号切换、会话管理、Provider、代理和 Handoff 的相关测试通过。

### 第四阶段 整理文档并完成打包验收

- [x] 整理历史文档、下载说明、重复锁文件和图标设计工件，检查引用与追溯。
- [x] 从清理后的同一源码版本重新运行完整检查、`.app` 和 DMG 构建，记录版本及校验值。
- [ ] 完成真实帐号 GUI 验收，覆盖启动、切换、Handoff、代理、额度与实际 Gateway 请求。
- [ ] 按目标分发方式完成签名及适用的公证；仅对实际验证过的架构声明支持。

完成条件：源码、文档、版本与安装包能够对应；完整测试与打包验证通过，手工验收结果已记录。

## 保留的产品能力与数据约定

保留多帐号管理、会话浏览与删除、Handoff、API 帐号、Responses 直连、Chat Completions
网关适配、独立代理、官方额度与 Reset Credit、菜单栏面板及 Gateway Monitor。
Antigravity 作为按配置启用的集成保留，Claude 与 Pi 仍属于后续适配范围。

遵守 [当前数据口径](../CONTEXT.md) 和 [请求监控设计](request-monitoring-design.md)：
不恢复已退役的本地日志金额估算；官方额度、Gateway 观测和实际账单分开表达；缺失值
保持未知；响应头延迟不能作为首内容或首 token 延迟。精简不能删除用户帐号、凭证、
会话或历史数据库，也不能改动已选定的正式黑底圆角图标。
