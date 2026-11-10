# Todo: 按页面显示创建入口与状态栏刷新

- **Status**: 验证成功
- **Scope**: 主窗口操作入口的位置与可见性。

## Why

跨页面重复的大按钮占用标题区，刷新应作为轻量全局操作。

## Behavior

- Input：概览、Sessions、Providers、Monitor、Settings，正常或刷新中的状态。
- Output：概览保留 New Account / External API；其他页面隐藏通用创建工具栏；Providers 自带添加入口保留；状态栏全局显示无文字刷新图标。
- Constraints/errors：复用现有刷新行为、加载禁用、悬停提示和可访问名称，保留单帐号刷新及真实错误展示。

## Test first

- 页面切换验证按钮可见性；Providers 添加入口继续可用。
- 刷新位于状态栏且图标无文字，点击调用既有刷新；进行中禁用，完成后恢复。
- Expected RED：当前顶栏全局显示所有按钮，状态栏缺少刷新。

## Implementation

App 按路由显示工具栏，将刷新按钮放入状态栏；使用窄图标样式与加载动画。

## Verification

App 测试与前端回归、lint/build/脚本/格式；浏览器亮暗、窄窗口几何与原生安装启动。

## Evidence

- RED：新增五个场景失败：其他页面仍显示创建工具栏，状态栏没有刷新入口。
- GREEN：完整前端 292 项通过；49 项 Node、ESLint、TypeScript/Vite、UI smoke 与修改文件 Prettier 通过。
- 浏览器：五个页面的创建入口、状态栏图标位置与 24px 尺寸、1100/1440 窗口无溢出检查通过；悬停提示、禁用/恢复由组件测试验证。
- 预览为明确标注的示例数据：`output/ui-preview/context-actions-light.png` 与 `context-actions-dark.png`。
- Changed files：App.tsx / App.handoff.test.tsx / workspace.css。本轮未修改后端和数据存储。
- 安装包、签名与 DMG 组件校验通过；已更新本机应用并重新启动，原生进程和托盘初始化正常。

## Done

- [x] 测试先行并确认 RED。
- [x] 页面入口与状态栏行为在上述范围内。
- [x] 回归、浏览器和安装启动检查通过。
- [x] 状态为验证成功。
