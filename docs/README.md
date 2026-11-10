# LamDock 文档

## 使用与开发

- [项目说明与路线图](../README.zh-CN.md)
- [桌面运行与验证](DESKTOP-RUNTIME.md)
- [新版界面预览](ui-preview.md)（主窗口/托盘明暗主题及名称输入修复）
- [帐号独立代理使用说明](account-proxy-usage.md)
- [用量统计术语](../CONTEXT.md)

## 设计与契约

- [Provider Gateway 设计](remote-provider-gateway-full-design.md)
- [Gateway 协议覆盖与验证](remote-provider-gateway-contract-coverage.md)
- [帐号独立代理设计](account-proxy-design.md)
- [Tauri 命令契约](05-tauri-command-contracts.md)
- [安全与数据保护](03-security-and-data-safety.md)
- [额度重置与 Reset Credit](TAURI2_RUST_CODEX_RESET_EXPIRY_AND_QUOTA_RESET.md)
- [请求监控的数据口径与采集设计](request-monitoring-design.md)

历史设计背景见 [FINAL-DESIGN](FINAL-DESIGN.md) 和 [DESIGN_GOAL](DESIGN_GOAL.md)；
当前功能约定见上方专题文档，验收见 [当前手工验收](manual-acceptance.md)。

## 后续工作

- [发布检查与精简计划](release-readiness-and-cleanup-plan.md)（2026-11-02 审查基线）；[执行约束](release-execution-scope.md)、[执行进度](todos/REL-001/execution-map.json)、[本轮验证与工件](release-cleanup-execution-report.md)
- [Claude／多 Agent 适配计划](CLD-001-claude-agent-support-plan.md) 与 [执行任务](todos/CLD-001/README.md)
- [Gateway 后续改进计划](todo-provider-gateway-review-remediation.md)
- [Gateway 工具桥接的待验证边界](todo-fix-gateway-chat-tool-namespace-bridge.md)
- [External API 布局的剩余任务](todo-optimize-external-api-layout.md)
- [应用数据目录与凭证方案](todo-lam-home-directory-and-plaintext-credentials.md)
- [Gateway 首响应超时设置](todo-gateway-first-response-timeout-setting.md)
- [API 帐号启动恢复的待验证项](todo-startup-partial-api-account-recovery.md)
- [当前手工验收](manual-acceptance.md)（含旧计划中仍有效的真实帐号、ChatGPT 重启及 Antigravity 验证项）
