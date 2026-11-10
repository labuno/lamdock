# Todo: Keep LAM Launchable After Partial API Account Deletion

- **Status**: 待测试验证
- **Scope**: Startup recovery must preserve a partially deleted profile directory without reattaching it or aborting application launch.
- **Baseline**: `687bf50`

## Why

An interrupted API-account delete removed the managed profile files while a running Codex process recreated runtime files. Startup recovery treated those runtime signals as an intact managed account, attempted a reattach, and caused the packaged Tauri app to panic during `did_finish_launching`.

## Behavior

- **Input**: A delete journal at `detached`, no committed binding, and a profile directory that has runtime files but lacks its managed marker or `config.toml`.
- **Output**: Preserve the profile directory, do not reattach it, compensate any exclusive orphan Provider, clear the completed recovery journal, and allow startup to continue.
- **Constraints/errors**: An intact managed profile with its config must retain the existing reattach-on-interruption behavior; no session/runtime file may be deleted by partial-delete recovery.

## Test first

- Normal: Existing crash-after-detach test continues to reattach an intact managed API account.
- Edge/invalid: A runtime-recreated, unmanaged profile is preserved and remains unbound.
- Error/state conflict: Recovery is idempotent and returns zero work on its second run.
- Expected RED: Current recovery reattaches the partial profile or returns an error instead of leaving it safely unbound.

## Implementation

Require both the managed-account marker and `config.toml` before compensating a detached delete by reattaching. Treat any other surviving directory as partial deletion: preserve it, apply existing Provider cleanup rules, and clear the journal. Do not alter normal attach/detach behavior or delete profile data.

## Verification

- Focused: `provider_phase4_api_account` partial and intact recovery tests.
- Regression/lint/build: full provider phase 4 suite, Rust build, packaged app launch smoke.

## Evidence

- RED: Focused Rust test reproduced the packaged crash precursor: recovery returned `IO_ERROR: No such file or directory` for a runtime-recreated profile lacking its managed files.
- GREEN: 2026-11-02 `cargo test --offline -j 2 --test provider_phase4_api_account` 27 项通过；完整 `make check` 通过。部分删除、完整帐号中断恢复和第二次恢复零工作均通过。
- Changed files: 本轮未修改恢复实现；已核对 `provider_api_v2.rs` 与现有 `provider_phase4_api_account.rs` 测试。
- Remaining limitation: 安装包真实 GUI 启动验收未完成，详见 [发布清理执行记录](release-cleanup-execution-report.md)。

## Done

- [x] Test was written first and RED observed, or exception recorded.
- [x] Implementation stays in scope.
- [x] Focused and relevant regression checks pass.
- [ ] Status is 验证成功.
