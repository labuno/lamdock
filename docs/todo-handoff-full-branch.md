# Todo: Handoff 完整来源分支

- **Status**: 验证成功
- **Scope**: Handoff 完整来源分支

## Behavior

- **Input**: 超过 80 条的分歧会话
- **Output**: 交接包含完整来源与目标分支，原会话不变
- **Constraints/errors**: 保留用户数据及现有功能，不扩展无关基础设施。

## Test first

- 早期用户消息和最后事件均保留；现有空/短分支与兼容性测试回归
- Expected RED: 当前代码缺少上述输出。

## Implementation

移除按条数截断，交接标明完整分支；每次交接使用唯一文件名

## Verification

聚焦测试、相关回归与 lint/build；最后验证安装应用。

## Evidence

- RED：101 条分支事件的早期用户要求被截断，测试失败。
- GREEN：完整来源分支和最后事件均保留，重复交接生成独立文件，原目标时间线不变；相关兼容/分支回归通过。
- 回归：287 项前端、49 项 Node、573 项 Rust 通过，1 项 Rust 忽略；lint/build/Clippy/fmt 与修改文件 Prettier 通过。
- 已构建 DMG、验证签名与组件，并更新本机 `/Applications/LamDock.app`。
- 验收边界：视觉和点击使用隔离浏览器；原生验证进程/托盘启动。cmux Computer Use 初始化未完成，无法取得真实窗口截图。

## Done

- [x] 测试先行并观察 RED。
- [x] 实现在上述范围内。
- [x] 聚焦与相关回归通过。
- [x] 状态为验证成功。
