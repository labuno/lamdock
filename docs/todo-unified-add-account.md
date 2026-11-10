# Todo: Unified English Add Account entry

- **Status**: 验证成功
- **Scope**: One account creation shell with a type chooser.

## Behavior

- Input: global Add Account or the Providers API shortcut.
- Output: global entry first offers Codex Account / External API in English; the selected branch uses existing creation forms. Providers opens the API branch of the same Add Account modal.
- Constraints/errors: preserve CLI login, Session import, PAT upload, API review/create and error reporting. Keep refresh available. Closing and reopening the global entry returns to type selection.

## Test first

Chooser has no credential fields before selection; Codex/API paths remain functional; API shortcut uses shared shell; switching back/reopening works; existing name-casing and mode tests pass after explicit type selection. Expected RED: two independent entry points/modals exist today.

## Implementation

Use local account-type state in App, remove the separate externalApi modal state/overview button, reuse ApiAccountFlow and current Codex forms; add English chooser layout.

## Verification

App and flow tests, frontend regression/lint/build/Node/UI smoke/format; browser type selection and Providers shortcut in both themes; package and native startup.

## Evidence

- RED: App flow tests failed because the global entry was New Account and API used a separate modal. Old UI smoke markers also rejected the unified shell.
- GREEN: 293 frontend tests and 49 Node tests passed; lint/build/UI smoke and changed-source formatting passed. Removed the obsolete dedicated API-modal store test; the shared account-modal lifecycle and both branches are covered.
- Browser: all five pages open the same English chooser; Codex/API selection, Back, close/reopen, name-case preservation, modal bounds at 1100/1440, Providers direct API shortcut passed. No real account was created.
- Preview: `output/ui-preview/add-account-chooser-light.png`, `add-account-chooser-dark.png`, `add-account-api-branch-dark.png`, all use labeled sample data.
- Native package/update verification: signed app and DMG verification passed; installed app updated and reopened, with native process and tray startup confirmed.

## Done

- [x] Test first and expected RED observed.
- [x] Shared shell and existing creation flows stay in scope.
- [x] Regression, browser and installation checks passed.
- [x] Status is 验证成功.
