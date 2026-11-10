# 主窗口与托盘界面首版（2026-11-02）

按用户最新浅色/深色主窗口和浅色托盘参考图实现。本页截图为浏览器隔离渲染，
使用明确标注的示例数据，没有连接真实帐号或读写用户数据。

## 查看效果

- [主窗口：浅色](../output/ui-preview/workspace-light.png)
- [主窗口：深色](../output/ui-preview/workspace-dark.png)
- [托盘：浅色](../output/ui-preview/tray-light.png)
- [托盘：深色](../output/ui-preview/tray-dark.png)
- [Account name 原样输入与预览](../output/ui-preview/account-name-case.png)

## 已实现

- 单层品牌栏、真实版本、模式和主题选择；页标题与统一的刷新/新建/API 操作区。
- 四张概览卡片、带数量的 Codex/Antigravity 切换、当前会话上下文和分区帐号卡片。
- 轻网格背景、边框/阴影、统一主按钮及明暗主题；底部悬浮导航保留 Monitor，不恢复 Usage。
- 额度摘要使用现有数据：帐号覆盖率继续表示 primary-window quota 覆盖，不宣称帐号在线率；
  耗尽/可用/未知状态有不同呈现，顶部汇总提醒已按用户要求移除。
- 外部 API 帐号不伪造额度或 Unlimited；不新增 Round-Robin、Auto-Failover、吞吐量或 Ping。
- 托盘按参考图调整顶部、三项摘要、当前帐号、集成切换、紧凑额度卡和底部操作；
  保留原有 328px 窗口宽度、滚动/自动尺寸、Relay、刷新、Open 与 Quit。
- 主窗口、托盘和两阶段加载页统一使用正式黑底圆角 PNG；正式资产没有改动。
- Add Account 的普通创建、Session 导入、PAT 上传与 API 名称输入关闭系统自动大写、纠正和拼写检查；
  `ellie`、`eLlie`、`ELLIE` 的显示、预览及提交保留原大小写，原有字符校验不变。

## 验证

- 新增测试先 RED：概览/标题结构、托盘版本及活动卡、加载 Logo、名称输入属性；然后实现并回归。
- 完整 Vitest：27 个文件、278 项通过；ESLint、TypeScript/Vite 构建、未使用项检查、49 项 Node 脚本及 UI smoke 均通过。
- 隔离 Chromium 在 1280×820、1100×700 检查无横向溢出、帐号菜单及 Monitor 导航。
- 托盘在实际 328px 宽度检查明暗、滚动、集成切换和 Open；额度颜色、名称输入值/样式/提交参数已检查。
- 原始日志、浏览器预览夹具与前端来源快照保存在仓库外：
  `/Users/zhanhd/Documents/products/github/lamdock-ui-evidence-20261102-153817`。

## 后续修复与紧凑布局（2026-11-02）

- 帐号卡片在 1440px 宽下约从 401px 收紧至 332px；重置次数和到期日移到信息块，标题保持单行。
- Providers 使用可搜索列表与右侧选中项详情；协议、模型、认证引用、绑定和操作来自现有数据。
- Antigravity 默认自动发现语言服务监听端口；设置中的端口为可选覆盖项，清空后恢复自动。
- Handoff 的两列选择框可收缩，长标题最多显示三行；main → luna002 的超长摘要无横向溢出，底部按钮完整可见。
- [Providers 浅色](../output/ui-preview/providers-light.png)、[深色](../output/ui-preview/providers-dark.png)、[长标题 Handoff](../output/ui-preview/handoff-long-title.png)。
- 验证：282 项前端测试、49 项 Node、570 项 Rust（另 1 项忽略）；lint/build/Clippy/fmt/UI smoke 通过。
- 本机 Antigravity 未配置端口的实际查询成功：7 个模型、2 个额度分组；未输出令牌或凭证。
- 修改文件通过 Prettier；仓库原有其他文件的格式问题未在本轮扩大处理。
- 已更新本机应用并成功启动；main → luna002 的真实 Handoff 预览与按钮已通过 GUI 检查，未执行会话转移。首版旧安装包说明已由本节替代。

- 底部导航采用统一彩色圆角 SVG 图标与一体底座；Sessions 表格采用紧凑列与保护状态标记，保留实际清理规则。

- 按后续反馈移除 Overview 顶部额度汇总横幅；28 项相关测试通过，帐号额度与刷新入口保留。

## Providers 参考图及检查修复（2026-11-02）

- Providers 更新为配置摘要、协议筛选、四列连接列表与分组详情，继续使用正式 Logo；仅显示真实配置与最近上游测试记录，不伪造在线率或自动路由。
- 启动维护错误通过健康响应显示持久提示，保留冲突配置；依赖维护成功的网关监控在失败时不启动。
- Handoff 不再截取最后 80 条；完整分支材料和独立交接文件保留原目标时间线。
- Antigravity 并发请求等待在途结果，配置切换后及时接收完成结果。
- Sessions 四个时间选项单行等宽；新增 Deletable only，在分页前筛选可删除记录。原有最新 20 条、最近 7 天的保护规则保留。
- 回归：287 项前端、49 项 Node、573 项 Rust 通过，1 项忽略；修复了测试中三个额度读取案例缺少环境锁造成的并行污染。
- [Providers 浅色](../output/ui-preview/providers-light.png)、[Providers 深色](../output/ui-preview/providers-dark.png)、[Sessions 浅色](../output/ui-preview/sessions-light.png)、[Sessions 深色](../output/ui-preview/sessions-dark.png) 为明确标注的示例数据。
- 新安装包已构建并更新本机应用；空目录和损坏配置的原生启动均通过，未对真实帐号执行删除或会话转移。

- 当前 DMG：`apps/desktop/src-tauri/target/release/bundle/dmg/LamDock_0.4.4_aarch64.dmg`（18,072,713 bytes），SHA256 `9b611d28b8b86e63fc9eb413ba9eada56c6727f442370bfa6a3d6e313ef0a99d`；安装后进程与托盘正常，更新前后登录文件哈希一致。

## 页面操作入口精简（2026-11-03）

- 概览保留 New Account 与 External API；Sessions / Providers / Monitor / Settings 隐藏通用创建工具栏，Providers 自身的添加入口保留。
- 全局刷新移到状态栏，24px 图标按钮，没有可见文字；保留悬停提示、可访问名称、加载动画和刷新期间禁用。
- [浅色预览](../output/ui-preview/context-actions-light.png)、[深色预览](../output/ui-preview/context-actions-dark.png) 使用明确标注的示例数据。
- 验证：292 项前端、49 项 Node、lint/build/UI smoke 与修改文件格式检查通过；五个页面在 1100/1440 宽下无横向溢出。已更新本机应用并通过进程/托盘启动验证。

## 顶部全局入口与 Providers 单标题（2026-11-03 后续反馈）

- 刷新从底部移到顶部栏主题切换按钮左侧，以带边框的图标按钮呈现；顶部 New Account 在五个页面均可用，概览不再重复显示 New Account 大按钮。
- Providers 去掉通用标题与重复说明，页面只保留一级标题 Model Providers & Routing 和同一行 Add External API。
- 修复旧媒体查询在窄窗口强制顶栏换行的问题；1100/1440 宽度下品牌和操作区不重叠。
- [Providers 单标题浅色](../output/ui-preview/providers-single-heading-light.png)、[深色](../output/ui-preview/providers-single-heading-dark.png)、[全局顶部入口](../output/ui-preview/global-header-actions-light.png)，均为示例数据。
- 294 项前端、49 项 Node、lint/build/UI smoke 与格式检查通过；已更新本机应用并验证原生进程/托盘启动。

## Unified Add Account（2026-11-03）

- 顶部仅保留英文 Add Account 入口；打开后选择 Codex Account 或 External API。概览不再单独显示 External API 按钮。
- 使用同一个 Add Account 弹窗；Codex 分支保留 CLI Auth / Import Session / PAT，API 分支保留原有 Review/Create 表单。Providers 快捷入口直接进入同一弹窗的 API 分支。
- 可返回类型选择；关闭后从顶部重新打开恢复选择页。界面文案均为英文，名称大小写不变。
- [选择页浅色](../output/ui-preview/add-account-chooser-light.png)、[深色](../output/ui-preview/add-account-chooser-dark.png)、[API 分支](../output/ui-preview/add-account-api-branch-dark.png) 使用明确标注的示例数据。
- 293 项前端、49 项 Node、lint/build/UI smoke 与修改文件格式检查通过；浏览器验证五页入口、分支切换/返回/重新打开、Providers 快捷入口、1100/1440 布局。已更新安装应用并验证原生启动。

## Handoff target runtime（2026-11-03）

- Handoff 使用目标帐号的 Provider 与凭证；Target model 默认显示目标帐号模型，可仅对本次接力修改。
- 目标会话副本转换运行时 Provider 绑定，来源历史与目标帐号默认配置不变；旧失败副本会在再次接力时修正。
- [Handoff model 浅色预览](../output/ui-preview/handoff-target-model-light.png) 使用明确标注的示例数据；浏览器已验证帐号切换、模型填写和字段对齐。
- 详细合同与验证记录： [handoff target runtime](todo-handoff-target-runtime.md)。
