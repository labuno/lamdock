# 帐号独立代理

实现分支：`feat/20261021-account-proxy`。代理界面需要本分支的新版 LAM。普通 codex 的受管入口已安装在本机 ~/.local/bin/codex；本次没有替换 /Applications 中的应用，也未修改 Clash。自动修复入口的逻辑会随下次构建的 LAM 生效。

## 使用

1. 在官方 Codex 帐号卡片的 ⋮ 菜单点击 **Enable Proxy**。main 也支持。
2. 输入 HTTP/HTTPS 代理地址并保存，例如新加坡 `http://127.0.0.1:17891`、美国 `http://127.0.0.1:17892`。这些是规划示例，需 Clash 已实际监听对应端口才可使用。
3. 卡片的认证/套餐徽标旁显示绿色 **PROXY**，鼠标悬浮显示地址。绿色仅代表配置启用，不代表连接测试通过。
4. **Edit Proxy** 编辑，**Disable Proxy** 关闭；关闭后隐藏徽标和编辑入口，保留上次地址供再次开启。展开帐号操作时也提供同样入口。
5. 保存只影响后续启动的进程，已有 Codex 需退出后重新启动；不会自动终止任何会话。

全部关闭时不注入帐号代理变量，继续使用现有宿主环境、系统代理/TUN 和 Clash 规则；关闭不等于强制直连。

## 生效范围

覆盖普通 `codex` 受管入口、LAM 生成的恢复/交接/登录命令、托管 `codex-<name>` 快捷命令、`lam codex` Direct 启动及额度查询/额度重置/usage app-server 子进程。快捷脚本每次启动读取当前设置。直接执行包管理器原始 Codex 的绝对路径会绕过受管入口；ChatGPT 桌面应用不在此范围。

### 终端直接启动

LAM 在 `~/.local/bin/codex` 安装独立入口，不覆盖 Bun/npm 的原始程序。没有显式 CODEX_HOME 时使用 main；`codex-luna002` 或标准的 `CODEX_HOME=$HOME/.codex-luna002 codex` 使用 luna002 的设置。自定义外部 CODEX_HOME 不借用 main 的设置。关闭或未配置代理时不注入代理变量。

本机 PATH 已包含该目录且优先级正确。已打开的终端执行一次：

```sh
rehash
command -v codex
# 应显示 $HOME/.local/bin/codex
codex
```

无需重启电脑、Clash 或 LAM。已有 Codex 进程需要正常退出后重启。另一台机器应确认 `.local/bin` 在原始 Codex 之前；LAM 不自动编辑 shell 配置。安装遇到用户已有同名文件/符号链接会明确报冲突并保留原文件；原始程序缺失、配置损坏或 CODEX_BIN 指向自身会报错。

本期不提供外部 API 帐号的代理开关，其 Gateway 上游路径另行处理。

配置位于 `~/.lam/config/account-proxies/<profile>.json`，权限 0600，使用 LAM_HOME 时位于该目录下的 `.lam/config/account-proxies/`。不会写入 Codex 的 config.toml、认证和历史文件。帐号改名迁移代理配置，删除帐号时清除。

开启时向对应进程传入 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY（及小写）；NO_PROXY/no_proxy 仅保留 localhost、127.0.0.1、::1，确保本地接口仍直接连接。无额外后台代理进程，无接口协议/数据转换；本地转发由原有 Clash 承担。

## 开发与验证

在 `apps/desktop` 下使用 Node 24：

```sh
npm ci
npm test
npm run build
# 桌面开发运行（会按既有逻辑初始化 LAM 并修复托管快捷脚本）
npm run tauri:dev
```

后端在 `apps/desktop/src-tauri`：

```sh
cargo test --test account_proxy --test account_proxy_routing --test codex_terminal_entry
cargo test --test phase1_core quota_proxy
cargo test --lib proxy_curl
cargo test --quiet
```

最终验证（含终端入口补齐）：598 Rust 测试通过（5 ignored），288 前端测试通过，前端生产构建通过，变更 Rust/前端文件格式及新增代码 lint 通过。全量 Rust 日志位于 `apps/desktop/src-tauri/target/codex-terminal-entry-regression.log`（不入 Git）。

已用本机 Codex、临时目录和虚拟凭据验证 OpenAI HTTPS CONNECT 请求确实经过指定本地代理。测试代理主动返回 502 且不转发，仅证明网络代理支持，未声称真实帐号认证、完整流式/WebSocket 连接或美国/新加坡 VPS 出口测试成功。

既有检查问题（基线亦存在）：全量 lint 中 App.tsx 的 set-state-in-effect 错误与 authCommand unused 警告；test:ui 静态脚本要求已不存在的 No sessions. 文案。未改动无关业务消除这些报告。

终端入口本机验收：新登录 zsh 解析到 `~/.local/bin/codex`；真实 Codex `--version` 返回 0.163.0。临时假 Codex 通过同一命令读取到 main 的 `http://127.0.0.1:17891`，并用继承代理的 curl 探测得到出口 `161.118.202.47`。此项不发送真实帐号请求或消耗额度，不能代替重启后的真实 Codex 对话验收。

### cmux 兼容性修复

已修复 cmux shim 与 LAM 入口互相查找到对方导致的递归启动。解析原始 Codex 时跳过 cmux 的入口；cmux 外层已注入的参数/环境继续保留。不修改 cmux 安装文件。新增带超时与进程组清理的回归，验证 cmux 外层只运行一次并保留配置参数。

2026-10-21 的旧 0.4.3 安装包含缺陷入口；使用重新生成的 DMG 覆盖旧 App，否则旧 App 的自动修复可能把本地入口退回旧版本。

修复版安装包已重新生成：`apps/desktop/src-tauri/target/release/bundle/dmg/LAM_0.4.3_aarch64.dmg`。make dmg 完成校验与挂载验收，包内 App 已检查包含 cmux 排除分支。退出旧 LAM 后安装这个重新生成的包；版本号仍为 0.4.3。
