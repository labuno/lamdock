# Todo: Providers 新参考图布局

- **Status**: 验证成功
- **Scope**: Providers 新参考图布局

## Behavior

- **Input**: 已有 Provider/绑定、搜索、协议筛选、当前测试结果
- **Output**: 顶部配置摘要/协议筛选、四列紧凑列表、分组右侧详情、明暗主题/正式 Logo
- **Constraints/errors**: 保留用户数据及现有功能，不扩展无关基础设施。

## Test first

- 选择/筛选/空状态/绑定删除限制/按钮回调；模型名称搜索；浏览器无溢出
- Expected RED: 当前代码缺少上述输出。

## Implementation

仅真实配置统计与测试状态；沿用现有操作；未支持的自动路由不添加虚假开关

## Verification

聚焦测试、相关回归与 lint/build；最后验证安装应用。

## Evidence

- RED：缺少摘要、协议筛选、分组详情以及测试后刷新观察记录。
- GREEN：真实配置/测试记录展示、协议和模型名称筛选、选择与动作测试通过；1100/1440 浏览器无横向溢出，亮暗截图已更新。
- 回归：287 项前端、49 项 Node、573 项 Rust 通过，1 项 Rust 忽略；lint/build/Clippy/fmt 与修改文件 Prettier 通过。
- 已构建 DMG、验证签名与组件，并更新本机 `/Applications/LamDock.app`。
- 验收边界：视觉和点击使用隔离浏览器；原生验证进程/托盘启动。cmux Computer Use 初始化未完成，无法取得真实窗口截图。

## Done

- [x] 测试先行并观察 RED。
- [x] 实现在上述范围内。
- [x] 聚焦与相关回归通过。
- [x] 状态为验证成功。
