# Todo: Handoff uses the selected target runtime

- **Status**: 验证成功
- **Scope**: Cross-account Codex resume from API to login and login to API.

## Behavior

- Input: source session, target account configuration and an optional explicit model.
- Output: resume under target credentials and Provider; use explicitly chosen model or target default when models differ. Preserve original source history and account configuration.
- Constraints/errors: original model/provider provenance stays available; unsupported history errors must not be confused with missing source Provider configuration. Verify actual installed Codex behavior on isolated fixtures before choosing the projection method.

## Test first

Reproduce a source-only Provider in session metadata while target config has a different Provider; verify both directions use target runtime, source files remain unchanged, and existing diverged-history behavior is retained. Unit/integration regressions must cover missing/identical/different model and explicit target model.

## Implementation

First inspect the current Codex resume contract; implement the smallest target-runtime projection supported by it. Extend Handoff request/UI only where explicit selection must be transmitted.

## Verification

Focused Rust/frontend tests, isolated real-Codex bootstrap against a local fixture server, related regression, package/startup.

## Evidence

- RED: source-only Provider reproduced missing-provider bootstrap with Codex 0.166.0, including with CLI Provider/model overrides. Runtime metadata must be projected in the target copy.
- `tests/relay_target_runtime.rs`: both API/login directions, identical/different models, explicit model, old failed-copy repair preserving target turns, absent default, invalid model and shared-history detection across Provider projections.
- Target metadata records the original Provider for provenance; history comparisons ignore only runtime Provider metadata. Source transcript, target auth and default config are preserved.
- Real CLI fixture with a custom target Provider reached a local HTTP server after projection. Built-in `openai` passed Provider bootstrap and reached authentication using a fake fixture key; no real account credential or conversation was used. This is not an authenticated end-to-end quota test.
- Frontend: 293 tests passed; lint, TypeScript/Vite build, 49 Node tests and UI smoke passed. Browser fixture verified target defaults, switching accounts, manual model input and aligned fields; no session launched.
- Preview: `output/ui-preview/handoff-target-model-light.png` (sample data).
- Full Rust regression: 580 passed, 1 ignored. Required Clippy and formatting passed using the repository `make check` scope; an additional `--all-targets` experiment exposed existing lint warnings in gateway test fixtures (complex type / mutex across await), outside this change.
- Same-home real CLI repair probe: initial resume returned `modelProviderNotConfigured`; projecting the existing failed copy then resuming in that same temporary CODEX_HOME reached the local server (1 request, missing-provider error absent).
- `make dmg` passed; signed bundle and mounted DMG verification passed; `lam-core` remains excluded. DMG: 18,089,971 bytes; SHA256 `b4a241aefbef2af49edee773778a7aad8c1ed54f043df06e0e3ddf6b930bea30`.
- Fresh-HOME packaged startup and installed `/Applications/LamDock.app` startup both passed (process alive, menu bar tray ready). Installed bundle updated with reversible backup in the system temporary directory. No real Handoff or authenticated model request was executed.

## Follow-up: existing Codex thread index

A real indexed thread still failed after rollout projection because `state_5.sqlite` retained the source Provider. The original fixture did not cover a pre-existing thread index. See [index Provider repair](todo-handoff-index-provider.md) for the additional regression and real-thread resume evidence.
