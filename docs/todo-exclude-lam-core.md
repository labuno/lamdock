# Todo: 安装包排除开发诊断工具 lam-core

- **Status**: 验证成功
- **Scope**: 仅调整应用/DMG 打包边界，保留 `make accounts` 和全部运行时组件。
- **Baseline**: 0.4.4；main 尚无提交；现有 DMG 18,559,460 字节，SHA-256 为 `f94197e790841ce89e5665a2e095031f10076214b23ef0edd3b435cba5095568`。

## Behavior

- 输入：Tauri 生成的应用包，可能包含 `Contents/MacOS/lam-core`。
- 输出：finalize 在签名前排除该文件，保留主程序、三个运行时组件和 UI 资源；DMG 验证拒绝夹带 lam-core 的应用。
- 约束：不修改 Cargo 目标或 make accounts；不裁剪符号、不更改 UI 和业务逻辑。缺少运行时组件时打包明确失败。

## Test first

- 新增 Node 临时应用包集成测试：finalize 后 lam-core 不存在，主程序、三组件和资源保留；重复 finalize 成功。
- 验证缺少必要组件时 finalize 失败；夹带 lam-core 的有效签名应用在创建 DMG 前被拒绝。
- 预期 RED：当前 finalize 保留 lam-core，DMG 未检查该文件。

## Implementation

仅修改 package-gateway-components.mjs：finalize 删除准确的开发工具路径后按原流程签名并生成组件哈希；打包及挂载验证检查不含该文件。

## Verification

- Node 打包聚焦与完整脚本测试；`LAM_HOME=<临时空目录> make accounts`。
- 重新 make dmg，验证 app/DMG 不含 lam-core、三组件完整和签名校验通过，记录实际大小与哈希。
- 不启动新应用或干扰当前运行的旧 LAM；GUI 不变以未改前端源码及资源哈希为证。

## Done

- [x] 测试先行并观察预期 RED。
- [x] 修改限定于打包边界。
- [x] 聚焦、脚本测试及实际打包验证通过。

## Evidence

- RED：finalize 后仍存在 lam-core；DMG 未拒绝夹带 lam-core 的应用，两个新增行为测试失败。
- GREEN：48 项 Node 脚本测试全部通过；隔离 LAM_HOME 下 make accounts 返回 accounts=0。
- make dmg 通过：应用和 DMG 均只含主程序与三个运行时组件，签名、组件哈希及只读挂载校验通过，镜像已卸载。
- UI 源码及包内 Resources 与修改前逐文件哈希一致；未启动或替换正在运行的旧 LAM。
- DMG：18077611 字节，较修改前减少 481849 字节。
- SHA-256：`60ca10468cd6047b8a55b78a7c08b62c43e91956930fd511abead3a1f37bfaaa`。
- 原始日志、来源快照及前后比较：`/Users/zhanhd/Documents/products/github/lamdock-exclude-lam-core-20261102-145428`。
