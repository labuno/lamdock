# Todo: Synchronize the target Codex thread index on Handoff

- **Status**: 验证成功
- **Scope**: Provider binding in an existing target `state_5.sqlite` thread record.

## Why / Behavior

The rollout header is already projected, but Codex resumes using the cached Provider in `threads`. Handoff must update only the selected target thread's Provider before returning a launch command. Keep source DB, all conversations, target credentials, unrelated rows and other thread fields unchanged. Missing DB/index row needs no insertion; unreadable or locked DB must return an explicit error.

## Test first

Reproduce both directions with an existing stale thread record, including an already-current target file; verify unrelated rows and source DB unchanged, repeated Handoff works, absent DB stays absent, locked/corrupt DB reports failure without returning a launch command. Verify the actual CLI using an existing indexed thread fixture.

## Implementation / Verification

Use the existing rusqlite dependency and narrow Codex-state adapter. Run targeted and full Rust tests, required lint/format, real CLI fixture, rebuild/sign/install and native startup. Back up the user's database before repairing the one failing target row; do not execute a real model turn.

## Evidence

- RED: stale indexed Provider stayed `account-api` after Handoff; corrupt target DB still incorrectly returned a launch command. Both regression tests failed before implementation.
- GREEN: all 11 `relay_target_runtime` tests passed, including both directions, already-current repair, absent DB/row, corrupt DB and lock conflict.
- Changed implementation: `services/handoff_runtime.rs` narrowly updates the selected existing target thread's Provider; `services/relay.rs` synchronizes before returning the resume command. No schema, credentials, defaults or transcript changes.
- Actual failing target row was repaired after SQLite backup under the private system temp directory. Receipt: `/tmp/lamdock-index-provider-repair-location`. All other columns of the target row and the rollout file hash were unchanged.
- Real installed Codex 0.166.0 `app-server` resumed thread `01a18659-28ca-71e3-85e9-6dd6307c6da2` successfully with Provider `openai` and model `gpt-6.1-sol`; only `initialize` and `thread/resume` were sent, no model turn was started. Evidence: `/tmp/lamdock-real-resume-verification.json`.
- Existing `phase1_core` test setup used plain text as a fake SQLite file. Updated that fixture to a valid empty SQLite DB now that Handoff uses the index; corrupt DB handling remains explicitly tested in `relay_target_runtime`.
- Full Rust regression: 584 passed, 1 ignored; required Clippy (`-D warnings`) and Rust formatting passed. Frontend sources did not change; package build runs TypeScript/Vite validation.
- `make dmg` passed; signatures and mounted DMG verified. DMG: 18,123,453 bytes, SHA256 `b7aa070ed3cad753e5c77c69e9cd370fbc6cf999a07b76b47049a81d77785cfb`; `lam-core` remains excluded.
- Fresh-HOME and installed native startup passed (process alive, tray ready). `/Applications/LamDock.app` updated; previous bundle retained under a private system temp directory. Post-resume real rollout/index Provider both verified as `openai`.

## Done

- [x] Regression tests written first and RED observed.
- [x] Target Provider sync stays within the selected existing thread record.
- [x] Focused/full regression, Clippy, formatting, package and installed startup pass.
- [x] Real failing session resumed successfully without starting a model turn.
