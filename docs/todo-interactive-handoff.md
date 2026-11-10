# Todo: Open Handoff directly in interactive Codex

- **Status**: 验证成功
- **Scope**: Diverged-summary launch command and observable CLI execution.

## Behavior

Input is the selected target runtime, session ID and handoff prompt. Open one interactive `codex resume SESSION PROMPT`, so summary progress and errors are visible and the user can interrupt; preserve the target timeline, credentials, selected model and complete source handoff material. Do not gate the UI behind an unattended `exec resume && resume` step. Historical-model warnings alone do not establish a request failure.

## Test first / Verification

RED: launch-planner and service tests require a single interactive resume with the prompt, permission/model flags once and safe quoting, for both direct and Gateway routes. Verify the actual Codex positional-prompt contract and a real generation separately from session hydration. Confirm app/package startup. A short fixture completion is not evidence that the user's large-history summary completed; record the actual observed scope.

## Evidence

- RED: Gateway planner still emitted two launcher invocations; test required one interactive resume.
- GREEN: direct/Gateway shell fixtures validate one interactive resume carrying the exact escaped prompt; service tests require model/permission flags only once and preserve both histories.
- Actual Codex 0.166.0 help establishes `codex resume [SESSION_ID] [PROMPT]`.
- Real large-history inference test used a private isolated copy of the user's failing rollout, the target official login and `gpt-6.1-sol`, without modifying the original conversation. Observed pre-turn `ContextLimit` auto-compaction and server `response.compaction.compacting` events; then `contextCompaction`, an assistant message containing the expected marker and `turn/completed` with status `completed`, no error. Log: `/tmp/lamdock-real-history-generation.log`. Temporary credentials/history were removed afterward.
- This validates compaction plus actual generation for the large history. It does not assert the entire 2.9 MB diverged handoff was summarized; the new interactive launch exposes that progress and allows cancellation.
- Full Rust regression: 585 passed, 1 ignored; required Clippy and formatting passed. TypeScript/Vite and native desktop bundle build passed. Only desktop launch planning changed; existing verified sidecars were retained and bundle finalization/signature/component verification passed.
- DMG mounted and verified: 18,115,917 bytes; SHA256 `18f9e0b5aa886c47aa3f6ed1252504e2837687a2546e17b361ee27da21b8ce17`.
- Installed `/Applications/LamDock.app` updated and signature verified; process alive and tray ready. Previous bundle backed up in a private system temporary directory.
