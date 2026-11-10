# Todo: 顶部全局快捷操作与 Providers 单标题

- **Status**: 验证成功
- **Scope**: 根据 2026-11-03 截图反馈调整操作可见性和标题留白。

## Why

底部状态栏刷新不易发现；其他页面也需要随时添加帐号。Providers 的通用标题与页面标题重复占用空间。

## Behavior

- Input：五个主页面，刷新空闲或进行中。
- Output：顶部栏全局提供紧凑 New Account 和图标刷新；刷新保留提示/禁用/动画。概览保留 External API 按钮。Providers 仅显示 Model Providers & Routing 一行标题与添加按钮。
- Constraints/errors：复用现有刷新/添加流程，不改变帐号数据、Providers 绑定和主题行为；不再同时显示两处全局刷新按钮。

## Test first

五个页面均能从顶部刷新/添加，点击可打开帐号流程；Providers 只有一个一级标题且移除通用说明；加载禁用与结束恢复。预期 RED：当前添加只在概览、刷新在底部、Providers 双标题。

## Implementation

App 顶栏增加全局快捷操作；移走页内 New Account 和底部刷新；Providers 省略通用页头，页面自身使用单行一级标题；CSS 明暗及窄窗口对齐。

## Verification

App/Provider 测试、前端回归与 lint/build/脚本/格式；浏览器五页、两种主题、1100/1440 宽验证，安装启动。

## Evidence

- RED：七个场景失败，覆盖缺少顶部入口、Providers 仍有重复标题；浏览器在 1100px 发现旧媒体查询导致顶部控件换行。
- GREEN：294 项前端、49 项 Node、lint/build/UI smoke 通过；修改文件 Prettier 通过。
- 浏览器五页验证：刷新和添加始终位于顶部，Sessions 可直接打开 Add Account；1100/1440 宽下顶部不换行、不与品牌重叠，Providers 只有一个主标题。
- 亮暗预览：`output/ui-preview/providers-single-heading-light.png`、`providers-single-heading-dark.png`、`global-header-actions-light.png`，均为示例数据。
- 已完成签名/DMG 校验，更新本机应用并重新打开；原生进程与托盘启动通过。

## Done

- [x] 测试先行并观察 RED。
- [x] 顶部入口和单标题符合本轮合同。
- [x] 前端回归、浏览器及安装启动通过。
- [x] 状态为验证成功。
