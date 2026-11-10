# LamDock 桌面运行与验证

桌面应用使用 Tauri v2、React、TypeScript 和 Rust。开发时由 Vite 提供界面，
原生窗口通过系统 WebView 加载页面，前端通过 Tauri `invoke` 调用 Rust 命令。

## 运行

在仓库根目录执行：

```bash
# 原生桌面窗口
make start

# 使用仓库提供的测试数据目录
LAM_HOME="$(pwd)/.fake-home" make start

# 仅预览前端
cd apps/desktop
npm run dev
```

Vite 固定使用 `127.0.0.1:1420`。仅运行前端时会显示 Browser preview，
文件系统、终端与帐号操作需要 Tauri 后端。

## 代码入口

| 入口                                            | 职责                                   |
| ----------------------------------------------- | -------------------------------------- |
| `apps/desktop/src/App.tsx`                      | 主窗口、页面与交互编排                 |
| `apps/desktop/src/stores/`                      | 前端状态与异步操作                     |
| `apps/desktop/src/lib/api.ts`                   | 前端 Tauri 调用边界                    |
| `apps/desktop/src-tauri/src/commands/`          | Rust 命令入口                          |
| `apps/desktop/src-tauri/src/services/`          | 帐号、会话、接力、额度、代理与用量服务 |
| `apps/desktop/src-tauri/src/services/gateway/`  | Gateway、sidecar 与启动器              |
| `apps/desktop/src-tauri/src/services/adapters/` | 协议转换                               |
| `apps/desktop/scripts/`                         | 构建、打包和契约验证                   |

## 验证与打包

在 `apps/desktop` 执行前端验证：

```bash
npm test
npm run build
npm run test:ui
```

在仓库根目录执行完整检查或打包：

```bash
# 前端构建、Vitest、ESLint、Node 脚本、UI smoke、Rust 格式/Clippy/完整测试
make check

make build
make dmg
```

`make check` 是本地、CI 和 Release 共用的完整检查入口，默认 Vitest 使用两个 worker，
Rust 测试使用两个编译 job；可用 `TEST_WORKERS` / `CARGO_JOBS` 调整。
Release 先验证 package、锁文件、Tauri、Cargo 版本及标签一致，再检查和打包；
打包时不改写源码版本。手动从分支运行只上传工件，`v*` 标签才进入发布步骤。
升级版本时先运行 `make release-version VERSION=x.y.z`，更新 Cargo.lock 后提交版本文件，
再从该源码版本检查、打包和打标签。

当前电脑上的旧 LAM 与新项目保留相同应用标识和默认数据目录。并行验证请使用
`LAM_HOME="$(mktemp -d)" make start`，不要对两个运行实例共用真实帐号目录。
默认自动测试使用临时数据；手工认证投影修复已改为显式路径工具：
`cargo run --example repair-auth-projections -- /path/to/home`（在 src-tauri 执行）。
打包入口会准备 Gateway 组件，应用产物名称为 `LamDock.app`。
安装包只保留主程序及 `lam`、`lam-provider-gateway`、`lam-auth-helper` 三个运行时组件，
不携带开发诊断工具 `lam-core`。源码目录仍可运行 `make accounts`，由 Cargo 编译并列出检测到的帐号。

正式图标源为 `apps/desktop/src-tauri/icons/lamdock-master.png`，
界面使用同图的 `apps/desktop/src/assets/lam-orbit-icon.png`。
在 `apps/desktop` 执行 `npm run icons` 可生成各平台图标。

更多专题说明见 [文档入口](README.md)。
