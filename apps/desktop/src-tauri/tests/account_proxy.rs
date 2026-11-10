use localagentmanager_core::{
    delete_account, execute_create_account, execute_rename_account, list_accounts,
    update_account_proxy, CreateAccountRequest, DeleteAccountRequest, RenameAccountRequest,
    UpdateAccountProxyRequest,
};
use std::fs;
use std::path::Path;
use tempfile::TempDir;

fn fixture() -> TempDir {
    let home = TempDir::new().unwrap();
    fs::create_dir(home.path().join(".codex")).unwrap();
    fs::write(
        home.path().join(".codex/config.toml"),
        "model = \"gpt-5\"\n",
    )
    .unwrap();
    execute_create_account(
        home.path(),
        &CreateAccountRequest {
            name: "other".into(),
            copy_config_from: None,
            overwrite_wrapper: false,
        },
    )
    .unwrap();
    home
}

fn save(
    home: &Path,
    id: &str,
    enabled: bool,
    url: &str,
) -> localagentmanager_core::Result<localagentmanager_core::CodexAccount> {
    update_account_proxy(
        home,
        &UpdateAccountProxyRequest {
            profile_id: id.into(),
            enabled,
            url: url.into(),
        },
    )
}

#[test]
fn defaults_off_and_saves_per_account_without_touching_codex_files() {
    let home = fixture();
    assert!(list_accounts(home.path())
        .unwrap()
        .iter()
        .all(|a| a.proxy.is_none()));
    let original = fs::read(home.path().join(".codex/config.toml")).unwrap();
    let saved = save(home.path(), "main", true, " http://127.0.0.1:17891 ").unwrap();
    assert_eq!(saved.proxy.as_ref().unwrap().url, "http://127.0.0.1:17891");
    assert!(saved.proxy.unwrap().enabled);
    let accounts = list_accounts(home.path()).unwrap();
    assert!(accounts
        .iter()
        .find(|a| a.id == "other")
        .unwrap()
        .proxy
        .is_none());
    assert_eq!(
        fs::read(home.path().join(".codex/config.toml")).unwrap(),
        original
    );
    assert!(!home.path().join(".codex/auth.json").exists());
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = fs::metadata(home.path().join(".lam/config/account-proxies/main.json"))
            .unwrap()
            .permissions()
            .mode();
        assert_eq!(mode & 0o777, 0o600);
    }
}

#[test]
fn disabling_keeps_last_address_and_editing_does_not_change_other_accounts() {
    let home = fixture();
    save(home.path(), "main", true, "http://127.0.0.1:17891").unwrap();
    save(home.path(), "other", true, "http://127.0.0.1:17892").unwrap();
    let disabled = save(home.path(), "main", false, "").unwrap().proxy.unwrap();
    assert!(!disabled.enabled);
    assert_eq!(disabled.url, "http://127.0.0.1:17891");
    let updated = save(home.path(), "other", true, "https://proxy.example:8443").unwrap();
    assert_eq!(updated.proxy.unwrap().url, "https://proxy.example:8443");
}

#[test]
fn invalid_inputs_leave_saved_settings_intact() {
    let home = fixture();
    save(home.path(), "main", true, "http://127.0.0.1:17891").unwrap();
    for url in [
        "",
        "127.0.0.1:17891",
        "socks5://localhost:17891",
        "http://",
        "http://localhost:99999",
        "http://localhost/a",
        "http://localhost/?a=b",
        "http://localhost/#x",
        "http://local\nhost:80",
    ] {
        assert_eq!(
            save(home.path(), "main", true, url).unwrap_err().code,
            "ACCOUNT_PROXY_URL_INVALID",
            "{url}"
        );
    }
    assert!(save(home.path(), "missing", true, "http://localhost:80").is_err());
    assert!(save(home.path(), "../oops", true, "http://localhost:80").is_err());
    let settings = list_accounts(home.path())
        .unwrap()
        .into_iter()
        .find(|a| a.id == "main")
        .unwrap()
        .proxy
        .unwrap();
    assert!(settings.enabled);
    assert_eq!(settings.url, "http://127.0.0.1:17891");
}

#[test]
fn rename_moves_proxy_settings_and_delete_removes_them() {
    let home = fixture();
    save(home.path(), "other", true, "http://127.0.0.1:17892").unwrap();
    execute_rename_account(
        home.path(),
        &RenameAccountRequest {
            from_profile_id: "other".into(),
            to_name: "renamed".into(),
            overwrite_wrapper: false,
        },
    )
    .unwrap();
    let account = list_accounts(home.path())
        .unwrap()
        .into_iter()
        .find(|a| a.id == "renamed")
        .unwrap();
    assert!(account.proxy.unwrap().enabled);
    assert!(!home
        .path()
        .join(".lam/config/account-proxies/other.json")
        .exists());
    delete_account(
        home.path(),
        &DeleteAccountRequest {
            profile_id: "renamed".into(),
        },
    )
    .unwrap();
    assert!(!home
        .path()
        .join(".lam/config/account-proxies/renamed.json")
        .exists());
}

#[test]
fn corrupted_settings_report_an_error_instead_of_disabling_proxy() {
    let home = fixture();
    save(home.path(), "main", true, "http://127.0.0.1:17891").unwrap();
    fs::write(
        home.path().join(".lam/config/account-proxies/main.json"),
        "broken",
    )
    .unwrap();
    assert_eq!(
        list_accounts(home.path()).unwrap_err().code,
        "ACCOUNT_PROXY_CONFIG_INVALID"
    );
}
