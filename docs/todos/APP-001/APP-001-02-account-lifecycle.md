# APP-001-02: 当前帐号识别、删除与重命名联动

- **Todo ID**: APP-001-02
- **Execution Map**: docs/todos/APP-001/execution-map.json
- **Todo maturity**: DECOMPOSED
- **Task detail format**: v1
- **Source baseline**: `docs/APP-001-app-slot-shared-auth-plan.md`（sha256 见 traceability.json）

## Outcome

帐号列表按槽位链接目标标记当前接管 App 的帐号；删除被链接的帐号会先移除槽位链接；重命名被链接的帐号会把链接改指向新目录。

## Contract

- **Requirements**: `REQ-STP-03`, `REQ-STP-04`, `REQ-WP-01`, `REQ-TM-01`
- **Consumes**: `artifact:app-slot-link`
- **Produces**: `artifact:app-slot-lifecycle` — 与槽位一致的帐号列表、删除与重命名。
- **Gates**: `cargo test --offline --test app_slot_shared_auth`；`cargo test --offline --test integration_pat_accounts`。
- **Boundaries**: 槽位未链接时保留现有 `account_id` 后缀匹配；不改变删除和重命名的其他步骤与错误码。

## Tasks

- [ ] `T01` 编写生命周期测试并观察 RED。
  - **Test and RED**: 在 `tests/app_slot_shared_auth.rs` 增加：团队帐号共用 `account_id` 时只标记链接目标帐号为当前帐号；删除被链接帐号后槽位文件不存在（`symlink_metadata` 失败）；重命名后槽位链接指向新目录且内容可读。实现前失败。
  - **Execution logic**: 复用 APP-001-01 的测试辅助函数；重命名用 `overwrite_wrapper: true` 避免受本机 wrapper 影响。
  - **Files and responsibilities**: `apps/desktop/src-tauri/tests/app_slot_shared_auth.rs`。
  - **Verification**: 运行 Gate 命令记录 RED。
  - **Artifact handoff**: 作为 T02 的验收标准。
- [ ] `T02` 实现链接感知的当前帐号识别、删除与重命名。
  - **Test and RED**: T01 用例。
  - **Execution logic**: `mark_active_auth_account` 先读 `read_link`，命中则只标记链接目标帐号并返回；新增 `app_slot_links_into(home, old_home)` 返回指向某帐号目录的槽位链接及相对路径；`delete_account` 在删除目录前移除这些链接；`execute_rename_account` 在目录改名后用新目录重建这些链接。
  - **Files and responsibilities**: `apps/desktop/src-tauri/src/services/account.rs`。
  - **Verification**: 正常（标记、删除、重命名）、边界（槽位未链接或链接到其他帐号时不受影响）、状态（删除后 main 显示未登录）。
  - **Artifact handoff**: 产出 `artifact:app-slot-lifecycle`，供 APP-001-03 的按钮状态依赖 `isActiveAuth`。

## Tests

- `tests/app_slot_shared_auth.rs`：当前帐号识别、删除、重命名。
- **RED**: 未改动 `mark_active_auth_account`、`delete_account`、`execute_rename_account` 时三类用例失败。

## Done

- [ ] T01–T02 完成，Gate 通过，证据写入 execution-map。

## STOP conditions

- 重命名或删除流程需要改变既有错误码或步骤顺序才能通过：停止并回到设计评审。
