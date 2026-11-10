# 修复已有帐号启动时模型偏好冲突

- 状态：验证成功
- 输入：已有 Responses API 帐号，在 Codex 内更改 model 后重启 LamDock。
- 输出：保留当前模型，同步绑定快照，启动迁移成功且重复运行无变化。
- 约束：不修改登录凭证和会话；连接地址、Provider、认证的归属冲突仍明确报错。
- 测试先行：复现模型变更导致 CODEX_CONFIG_OWNERSHIP_CONFLICT；验证配置不被覆盖、绑定模型同步、幂等；验证连接漂移仍拒绝。
- 验证：聚焦 Rust 测试、相关回归、fmt/Clippy、构建安装包，用本机数据副本启动验证。

## 证据

- 本机数据副本复现：recover 成功，migrate 返回 `CODEX_CONFIG_OWNERSHIP_CONFLICT: model`。
- RED：新增测试 `startup_preserves_the_model_selected_in_codex_and_updates_the_binding` 在修改前复现同一错误。
- GREEN：API 帐号测试 29 项通过；完整 Rust 测试 566 项通过、1 项忽略；Clippy 与 fmt 通过。
- 本机数据副本修复后 recover / migrate / wrappers / codex 四步全部通过。
- 实现仅接受 Codex 的有效模型字符串偏好，刷新绑定模型与配置快照；连接与认证归属检查保持有效。
- 安装包构建、签名、DMG 挂载与组件校验通过；仍排除 lam-core。
- 使用原始数据副本启动打包应用 12 秒，进程存活、托盘初始化成功。
- 已备份原应用和启动配置到临时目录，替换 `/Applications/LamDock.app` 并通过 LaunchServices 启动；真实数据启动成功，原有 4 份登录文件 SHA256 全部不变，绑定模型与 Codex 配置一致。
- 安装包：`apps/desktop/src-tauri/target/release/bundle/dmg/LamDock_0.4.4_aarch64.dmg`，18,082,481 bytes。
- SHA256：`03ca752d604ddcaf27745bfa32e4b7c93eecaa94e311783e5a5fed97135b7c31`。
- 旧应用和配置备份位置记录在 `/tmp/lamdock-repair-backup-path`；真实帐号目录未删除或重置。
