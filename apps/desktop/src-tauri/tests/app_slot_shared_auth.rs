use localagentmanager_core::{
    delete_account, execute_rename_account, list_accounts, switch_to_pat_account,
    DeleteAccountRequest, RenameAccountRequest,
};
use std::fs;
use std::path::{Path, PathBuf};
use tempfile::TempDir;

fn test_jwt(payload: &serde_json::Value) -> String {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let bytes = serde_json::to_vec(payload).unwrap();
    let mut out = String::new();
    for chunk in bytes.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = (u32::from(b[0]) << 16) | (u32::from(b[1]) << 8) | u32::from(b[2]);
        for i in 0..=chunk.len() {
            out.push(TABLE[((n >> (18 - 6 * i)) & 0x3f) as usize] as char);
        }
    }
    format!("eyJhbGciOiJub25lIn0.{out}.sig")
}

fn chatgpt_auth(account_id: &str, user_id: &str, refresh: &str, last_refresh: &str) -> String {
    serde_json::to_string_pretty(&serde_json::json!({
        "auth_mode": "chatgpt",
        "OPENAI_API_KEY": null,
        "tokens": {
            "id_token": test_jwt(&serde_json::json!({
                "https://api.openai.com/auth": {
                    "chatgpt_account_id": account_id,
                    "chatgpt_user_id": user_id
                }
            })),
            "access_token": format!("at-{refresh}"),
            "refresh_token": refresh,
            "account_id": account_id
        },
        "last_refresh": last_refresh
    }))
    .unwrap()
}

fn account_home(home: &Path, id: &str) -> PathBuf {
    home.join(format!(".codex-{id}"))
}

fn write_account(home: &Path, id: &str, auth: &str) {
    let dir = account_home(home, id);
    fs::create_dir_all(dir.join("sessions")).unwrap();
    fs::write(dir.join("auth.json"), auth).unwrap();
}

fn slot_auth(home: &Path) -> PathBuf {
    home.join(".codex/auth.json")
}

fn write_slot_file(home: &Path, auth: &str) {
    fs::create_dir_all(home.join(".codex")).unwrap();
    fs::write(slot_auth(home), auth).unwrap();
}

fn slot_link_target(home: &Path) -> Option<PathBuf> {
    fs::read_link(slot_auth(home)).ok()
}

fn slot_exists(home: &Path) -> bool {
    fs::symlink_metadata(slot_auth(home)).is_ok()
}

#[test]
fn switch_links_app_slot_to_account_credentials() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    let auth = chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z");
    write_account(home, "a", &auth);

    switch_to_pat_account(home, "a").unwrap();

    assert_eq!(
        slot_link_target(home),
        Some(account_home(home, "a").join("auth.json"))
    );
    assert_eq!(fs::read_to_string(slot_auth(home)).unwrap(), auth);

    // A token refresh written by the App through the slot lands in the account itself.
    let refreshed = chatgpt_auth("acct-a", "user-a", "rt-a2", "2026-11-09T00:00:00Z");
    fs::write(slot_auth(home), &refreshed).unwrap();
    assert_eq!(
        fs::read_to_string(account_home(home, "a").join("auth.json")).unwrap(),
        refreshed
    );
}

#[test]
fn switching_between_accounts_relinks_without_touching_credentials() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "a",
        &chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z"),
    );
    let auth_b = chatgpt_auth("acct-b", "user-b", "rt-b1", "2026-11-01T00:00:00Z");
    write_account(home, "b", &auth_b);

    switch_to_pat_account(home, "a").unwrap();
    let refreshed_a = chatgpt_auth("acct-a", "user-a", "rt-a2", "2026-11-09T00:00:00Z");
    fs::write(slot_auth(home), &refreshed_a).unwrap();

    switch_to_pat_account(home, "b").unwrap();

    assert_eq!(
        slot_link_target(home),
        Some(account_home(home, "b").join("auth.json"))
    );
    assert_eq!(
        fs::read_to_string(account_home(home, "a").join("auth.json")).unwrap(),
        refreshed_a
    );
    assert_eq!(
        fs::read_to_string(account_home(home, "b").join("auth.json")).unwrap(),
        auth_b
    );
}

#[test]
fn unknown_app_credentials_are_imported_as_a_new_profile() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "a",
        &chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z"),
    );
    let unknown = chatgpt_auth("acct-0000f0d8b6", "user-x", "rt-x", "2026-10-31T00:00:00Z");
    write_slot_file(home, &unknown);

    switch_to_pat_account(home, "a").unwrap();

    let imported = account_home(home, "app-f0d8b6");
    assert_eq!(
        fs::read_to_string(imported.join("auth.json")).unwrap(),
        unknown
    );
    assert!(list_accounts(home)
        .unwrap()
        .iter()
        .any(|account| account.id == "app-f0d8b6" && account.has_auth));
    assert_eq!(
        slot_link_target(home),
        Some(account_home(home, "a").join("auth.json"))
    );
}

#[test]
fn imported_profile_name_does_not_collide_with_existing_profiles() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "a",
        &chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z"),
    );
    write_account(
        home,
        "app-f0d8b6",
        &chatgpt_auth("acct-other", "user-o", "rt-o", "2026-11-01T00:00:00Z"),
    );
    let unknown = chatgpt_auth("acct-0000f0d8b6", "user-x", "rt-x", "2026-10-31T00:00:00Z");
    write_slot_file(home, &unknown);

    switch_to_pat_account(home, "a").unwrap();

    assert_eq!(
        fs::read_to_string(account_home(home, "app-f0d8b6-2").join("auth.json")).unwrap(),
        unknown
    );
}

#[test]
fn newer_app_credentials_are_written_back_to_their_owner() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "a",
        &chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z"),
    );
    write_account(
        home,
        "b",
        &chatgpt_auth("acct-b", "user-b", "rt-b1", "2026-11-01T00:00:00Z"),
    );
    let newer_a = chatgpt_auth("acct-a", "user-a", "rt-a9", "2026-11-09T00:00:00Z");
    write_slot_file(home, &newer_a);

    switch_to_pat_account(home, "b").unwrap();

    assert_eq!(
        fs::read_to_string(account_home(home, "a").join("auth.json")).unwrap(),
        newer_a
    );
    assert!(!list_accounts(home)
        .unwrap()
        .iter()
        .any(|account| account.id.starts_with("app-")));
}

#[test]
fn older_app_credentials_do_not_overwrite_their_owner() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    let current_a = chatgpt_auth("acct-a", "user-a", "rt-a9", "2026-11-09T00:00:00Z");
    write_account(home, "a", &current_a);
    write_account(
        home,
        "b",
        &chatgpt_auth("acct-b", "user-b", "rt-b1", "2026-11-01T00:00:00Z"),
    );
    write_slot_file(
        home,
        &chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z"),
    );

    switch_to_pat_account(home, "b").unwrap();

    assert_eq!(
        fs::read_to_string(account_home(home, "a").join("auth.json")).unwrap(),
        current_a
    );
}

#[test]
fn app_credentials_without_last_refresh_do_not_overwrite_their_owner() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    let current_a = chatgpt_auth("acct-a", "user-a", "rt-a9", "2026-11-09T00:00:00Z");
    write_account(home, "a", &current_a);
    write_account(
        home,
        "b",
        &chatgpt_auth("acct-b", "user-b", "rt-b1", "2026-11-01T00:00:00Z"),
    );
    write_slot_file(home, &chatgpt_auth("acct-a", "user-a", "rt-a1", ""));

    switch_to_pat_account(home, "b").unwrap();

    assert_eq!(
        fs::read_to_string(account_home(home, "a").join("auth.json")).unwrap(),
        current_a
    );
    assert!(!list_accounts(home)
        .unwrap()
        .iter()
        .any(|account| account.id.starts_with("app-")));
}

#[test]
fn unparseable_app_credentials_are_still_imported() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "a",
        &chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z"),
    );
    write_slot_file(home, "{not json");

    switch_to_pat_account(home, "a").unwrap();

    assert_eq!(
        fs::read_to_string(account_home(home, "app-import").join("auth.json")).unwrap(),
        "{not json"
    );
    assert_eq!(
        slot_link_target(home),
        Some(account_home(home, "a").join("auth.json"))
    );
}

#[test]
fn repeated_switches_import_unknown_credentials_once() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "a",
        &chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z"),
    );
    write_account(
        home,
        "b",
        &chatgpt_auth("acct-b", "user-b", "rt-b1", "2026-11-01T00:00:00Z"),
    );
    write_slot_file(
        home,
        &chatgpt_auth("acct-0000f0d8b6", "user-x", "rt-x", "2026-10-31T00:00:00Z"),
    );

    switch_to_pat_account(home, "a").unwrap();
    switch_to_pat_account(home, "a").unwrap();
    switch_to_pat_account(home, "b").unwrap();

    let imported = list_accounts(home)
        .unwrap()
        .into_iter()
        .filter(|account| account.id.starts_with("app-"))
        .count();
    assert_eq!(imported, 1);
}

#[test]
fn app_credentials_of_a_shared_workspace_are_matched_by_user() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    let user_one = chatgpt_auth("acct-team", "user-1", "rt-1", "2026-11-01T00:00:00Z");
    write_account(home, "one", &user_one);
    write_account(
        home,
        "two",
        &chatgpt_auth("acct-team", "user-2", "rt-2", "2026-11-01T00:00:00Z"),
    );
    write_account(
        home,
        "c",
        &chatgpt_auth("acct-c", "user-c", "rt-c", "2026-11-01T00:00:00Z"),
    );
    let newer_two = chatgpt_auth("acct-team", "user-2", "rt-2b", "2026-11-09T00:00:00Z");
    write_slot_file(home, &newer_two);

    switch_to_pat_account(home, "c").unwrap();

    assert_eq!(
        fs::read_to_string(account_home(home, "two").join("auth.json")).unwrap(),
        newer_two
    );
    assert_eq!(
        fs::read_to_string(account_home(home, "one").join("auth.json")).unwrap(),
        user_one
    );
}

#[test]
fn api_key_accounts_cannot_take_the_app_slot() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "pro",
        r#"{"auth_mode":"apikey","OPENAI_API_KEY":"sk-test"}"#,
    );
    let current = chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z");
    write_slot_file(home, &current);

    let error = switch_to_pat_account(home, "pro").unwrap_err();

    assert_eq!(error.code, "APP_SLOT_API_KEY_UNSUPPORTED");
    assert_eq!(fs::read_to_string(slot_auth(home)).unwrap(), current);
    assert!(slot_link_target(home).is_none());
}

#[test]
fn active_auth_follows_the_slot_link_even_when_workspace_is_shared() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "one",
        &chatgpt_auth("acct-team", "user-1", "rt-1", "2026-11-01T00:00:00Z"),
    );
    write_account(
        home,
        "two",
        &chatgpt_auth("acct-team", "user-2", "rt-2", "2026-11-01T00:00:00Z"),
    );

    switch_to_pat_account(home, "two").unwrap();

    let active = list_accounts(home)
        .unwrap()
        .into_iter()
        .filter(|account| account.is_active_auth)
        .map(|account| account.id)
        .collect::<Vec<_>>();
    assert_eq!(active, vec!["two".to_string()]);
}

#[test]
fn deleting_the_linked_account_clears_the_app_slot() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "a",
        &chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z"),
    );
    switch_to_pat_account(home, "a").unwrap();

    delete_account(
        home,
        &DeleteAccountRequest {
            profile_id: "a".to_string(),
        },
    )
    .unwrap();

    assert!(!slot_exists(home));
}

#[test]
fn deleting_another_account_keeps_the_app_slot() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(
        home,
        "a",
        &chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z"),
    );
    write_account(
        home,
        "b",
        &chatgpt_auth("acct-b", "user-b", "rt-b1", "2026-11-01T00:00:00Z"),
    );
    switch_to_pat_account(home, "a").unwrap();

    delete_account(
        home,
        &DeleteAccountRequest {
            profile_id: "b".to_string(),
        },
    )
    .unwrap();

    assert_eq!(
        slot_link_target(home),
        Some(account_home(home, "a").join("auth.json"))
    );
}

#[test]
fn renaming_the_linked_account_relinks_the_app_slot() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    let auth = chatgpt_auth("acct-a", "user-a", "rt-a1", "2026-11-01T00:00:00Z");
    write_account(home, "a", &auth);
    switch_to_pat_account(home, "a").unwrap();

    execute_rename_account(
        home,
        &RenameAccountRequest {
            from_profile_id: "a".to_string(),
            to_name: "renamed".to_string(),
            overwrite_wrapper: true,
        },
    )
    .unwrap();

    assert_eq!(
        slot_link_target(home),
        Some(account_home(home, "renamed").join("auth.json"))
    );
    assert_eq!(fs::read_to_string(slot_auth(home)).unwrap(), auth);
}
