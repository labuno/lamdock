# Todo: 启动冲突不阻止界面打开

- **Status**: 验证成功
- **Scope**: 启动冲突不阻止界面打开

## Behavior

- **Input**: 损坏或归属冲突的配置
- **Output**: 返回启动问题并显示持久提示，保留配置；停止本次后续维护
- **Constraints/errors**: 保留用户数据及现有功能，不扩展无关基础设施。

## Test first

- 空工作区正常；损坏 Provider JSON 保留；连接漂移由现有迁移测试覆盖；health 传递提示
- Expected RED: 当前代码缺少上述输出。

## Implementation

新增启动维护模块返回问题，main 不再传播维护错误，health 与 App 展示问题

## Verification

聚焦测试、相关回归与 lint/build；最后验证安装应用。

## Evidence

- RED：缺少启动维护报告模块；界面无法呈现启动冲突。
- GREEN：正常/损坏配置启动测试、持久提示测试通过；打包应用在两类隔离目录均存活且托盘初始化完成，损坏文件字节不变。
- 回归：287 项前端、49 项 Node、573 项 Rust 通过，1 项 Rust 忽略；lint/build/Clippy/fmt 与修改文件 Prettier 通过。
- 已构建 DMG、验证签名与组件，并更新本机 `/Applications/LamDock.app`。
- 验收边界：视觉和点击使用隔离浏览器；原生验证进程/托盘启动。cmux Computer Use 初始化未完成，无法取得真实窗口截图。

## Done

- [x] 测试先行并观察 RED。
- [x] 实现在上述范围内。
- [x] 聚焦与相关回归通过。
- [x] 状态为验证成功。
