# APX-001 帐号独立代理

基线：feat/20261021-account-proxy，ff506e0。用户已确认菜单、徽标和默认关闭行为。

## 范围与合同
每个官方 Codex 帐号（含 main）保存 enabled 和 url；HTTP/HTTPS 正向代理，不改 API 地址、认证或 config.toml。关闭时不注入代理变量，沿用宿主环境/TUN；保留上次地址。开启时仅该帐号新进程使用配置，不自动重启现有进程。
UI：未开启菜单 Enable Proxy；开启后绿色 PROXY、悬浮地址、Edit Proxy 和 Disable Proxy；禁用后隐藏徽标和编辑入口。错误显示在编辑框，不伪装保存成功。展开卡片操作时也保留代理入口。
只开发 LAM，不修改 Clash；外部 API Gateway 帐号不提供本期开关，因为其上游请求由 Gateway 发起且当前明确禁用代理。

## 配置与边界
配置位于 ~/.lam/config/account-proxies/<profile>.json（0600），与 Codex 状态分离。写入时验证存在帐号及代理 URL，允许 http/https、有效主机和端口，不接受路径/query/fragment 或换行。禁用保留已有 URL。帐号改名移动配置，删除清除配置。
独立代理设置 HTTP_PROXY/HTTPS_PROXY/ALL_PROXY 及小写变量；NO_PROXY/no_proxy 仅保留 localhost、127.0.0.1、::1，保证外部请求不被继承的例外绕过，回环本地接口仍直连。不修改 LAM 自身或全局环境。
普通 codex 由 ~/.local/bin/codex 受管入口默认读取 main；标准 CODEX_HOME 指定帐号时按对应帐号读取；原始 Bun/npm 程序不修改。启动脚本读取配置；恢复会话、交接、登录使用同一设置。额度/重置额度/usage app-server 子进程按原始 profile 传递设置，临时 auth home 不改变归属。代理失败明确报错，不新增直连回退。

## Work packages
### settings
持久化、帐号读取、改名删除及 Tauri API；旧帐号默认无配置。
### routing
Direct 命令、wrapper、CLI 和 app-server/curl 出站一致。保留原 Gateway 与权限策略。
### interface
菜单/编辑框/徽标、存储更新、错误与重复提交状态、提示新进程生效。

## 验收
先行为测试 RED，再 GREEN：设置读写/非法输入/关闭保留/相互隔离；假 Codex 执行测试检查 env/参数/退出码；HTTP 代理模拟服务验证额度请求经代理；UI 操作保存/取消/失败/关闭及 main；全量相关 Rust 和前端测试、格式、lint、build。真实 VPS 出口测试依赖尚未配置的 Clash 17891/17892，本轮不改 Clash，不声称真实帐号已切换出口。

## 终端入口补齐

使用方式见 [帐号独立代理说明](account-proxy-usage.md)，入口行为由 [account_proxy_routing.rs](../apps/desktop/src-tauri/tests/account_proxy_routing.rs) 验证。LAM 启动修复独立入口；开启 main 设置前确认可安装，避免同名用户命令被覆盖。入口逐次读取配置、转发原始参数并执行 PATH 中下一个非自身 Codex，不增加运行时后台服务，也不改变原始 Codex 升级位置。

cmux 适配：原始程序查找跳过 cmux-cli-shims 及 CMUX_CODEX_WRAPPER_SHIM 指向的文件，避免 cmux -> LAM -> cmux 递归。仅改变 LAM 入口，不改 cmux；外层已注入参数保留。已补先失败后通过的回归。
