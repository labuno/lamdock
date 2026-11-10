# Todo: Antigravity 刷新完成状态

- **Status**: 验证成功
- **Scope**: Antigravity 刷新完成状态

## Behavior

- **Input**: 主窗口/托盘并发、查询中切换手动端口
- **Output**: 并发者等待在途查询；新配置请求得到完成结果，旧配置响应忽略
- **Constraints/errors**: 保留用户数据及现有功能，不扩展无关基础设施。

## Test first

- 阻塞等待与缓存身份；配置切换未完成时不会显示 in-progress 错误；卸载清理
- Expected RED: 当前代码缺少上述输出。

## Implementation

后端共享现有锁并等待完成，匹配缓存复用；前端保留取消与去重

## Verification

聚焦测试、相关回归与 lint/build；最后验证安装应用。

## Evidence

- RED：并发查询没有等待完成结果的行为。
- GREEN：并发锁等待、配置变化的旧响应忽略/完成结果接收、缓存身份测试通过；生产代码不再返回 in-progress 作为额度结果。
- 回归：287 项前端、49 项 Node、573 项 Rust 通过，1 项 Rust 忽略；lint/build/Clippy/fmt 与修改文件 Prettier 通过。
- 已构建 DMG、验证签名与组件，并更新本机 `/Applications/LamDock.app`。
- 验收边界：视觉和点击使用隔离浏览器；原生验证进程/托盘启动。cmux Computer Use 初始化未完成，无法取得真实窗口截图。

## Done

- [x] 测试先行并观察 RED。
- [x] 实现在上述范围内。
- [x] 聚焦与相关回归通过。
- [x] 状态为验证成功。
