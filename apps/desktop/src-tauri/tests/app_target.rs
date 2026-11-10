use localagentmanager_core::{
    get_app_target, switch_to_pat_account, AppTarget, AppTargetKind, InstallationLock,
    ManagedConfigProjection, ProfileBindingCollection, ProfileProviderBinding, ProjectionOwnership,
    ProviderHubPaths, StoreOptions, VersionedFileStore,
};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tempfile::TempDir;

const CHATGPT_AUTH: &str =
    r#"{"auth_mode":"chatgpt","tokens":{"account_id":"acct-a","refresh_token":"rt"}}"#;

fn write_account(home: &Path, id: &str) {
    let dir = home.join(format!(".codex-{id}"));
    fs::create_dir_all(dir.join("sessions")).unwrap();
    fs::write(
        dir.join("auth.json"),
        CHATGPT_AUTH.replace("acct-a", &format!("acct-{id}")),
    )
    .unwrap();
}

fn app_config(home: &Path) -> PathBuf {
    home.join(".codex/config.toml")
}

fn write_app_config(home: &Path, contents: &str) {
    fs::create_dir_all(home.join(".codex")).unwrap();
    fs::write(app_config(home), contents).unwrap();
}

fn seed_binding(home: &Path, profile_id: &str, provider_id: &str) {
    let root = ProviderHubPaths::for_home(home)
        .ensure_canonical_root()
        .unwrap();
    let store = VersionedFileStore::new(
        root.join("bindings.json"),
        InstallationLock::new(root.join("provider-hub.lock"), Duration::from_secs(1)),
        1,
        StoreOptions::default(),
    );
    let config_path = if profile_id == "main" {
        app_config(home)
    } else {
        home.join(format!(".codex-{profile_id}/config.toml"))
    };
    let projection = ManagedConfigProjection {
        config_path: config_path.to_string_lossy().into_owned(),
        ownership: ProjectionOwnership::Managed,
        before_hash: "before".into(),
        applied_hash: "applied".into(),
        previous_values: BTreeMap::new(),
        managed_values: BTreeMap::new(),
        provider_table_created_by_lam: true,
    };
    store
        .compare_and_swap(
            0,
            &ProfileBindingCollection {
                bindings: vec![ProfileProviderBinding::new_for_test(
                    profile_id,
                    provider_id,
                    "model-a",
                    projection,
                    1,
                    "fingerprint",
                )],
            },
        )
        .unwrap();
}

fn account_target(account_id: Option<&str>) -> AppTarget {
    AppTarget {
        kind: AppTargetKind::Account,
        account_id: account_id.map(str::to_string),
        provider_id: None,
    }
}

#[test]
fn app_target_is_the_linked_account_by_default() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(home, "a");
    write_account(home, "b");
    switch_to_pat_account(home, "b").unwrap();

    assert_eq!(get_app_target(home).unwrap(), account_target(Some("b")));
}

#[test]
fn app_target_is_an_empty_account_when_nothing_is_signed_in() {
    let tmp = TempDir::new().unwrap();

    assert_eq!(get_app_target(tmp.path()).unwrap(), account_target(None));
}

#[test]
fn openai_model_provider_keeps_the_account_target() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(home, "a");
    switch_to_pat_account(home, "a").unwrap();
    write_app_config(home, "model = \"gpt-5\"\nmodel_provider = \"openai\"\n");

    assert_eq!(get_app_target(home).unwrap(), account_target(Some("a")));
}

#[test]
fn unparseable_config_keeps_the_account_target() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(home, "a");
    switch_to_pat_account(home, "a").unwrap();
    write_app_config(home, "model_provider = [unclosed\n");

    assert_eq!(get_app_target(home).unwrap(), account_target(Some("a")));
}

#[test]
fn main_binding_makes_the_app_target_a_provider() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_app_config(home, "model_provider = \"account-pro\"\n");
    seed_binding(home, "main", "account-pro");

    assert_eq!(
        get_app_target(home).unwrap(),
        AppTarget {
            kind: AppTargetKind::Provider,
            account_id: None,
            provider_id: Some("account-pro".into()),
        }
    );
}

#[test]
fn binding_of_another_profile_does_not_affect_the_app_target() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(home, "a");
    switch_to_pat_account(home, "a").unwrap();
    seed_binding(home, "pro", "account-pro");

    assert_eq!(get_app_target(home).unwrap(), account_target(Some("a")));
}

#[test]
fn hand_written_model_provider_makes_the_app_target_custom() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_app_config(home, "model_provider = \"my-proxy\"\n");

    assert_eq!(
        get_app_target(home).unwrap(),
        AppTarget {
            kind: AppTargetKind::CustomProvider,
            account_id: None,
            provider_id: Some("my-proxy".into()),
        }
    );
}

#[test]
fn switching_accounts_is_refused_while_a_provider_is_attached() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(home, "a");
    write_account(home, "b");
    switch_to_pat_account(home, "a").unwrap();
    write_app_config(home, "model_provider = \"account-pro\"\n");
    seed_binding(home, "main", "account-pro");
    let config_before = fs::read(app_config(home)).unwrap();

    let error = switch_to_pat_account(home, "b").unwrap_err();

    assert_eq!(error.code, "APP_SLOT_PROVIDER_ATTACHED");
    assert_eq!(
        fs::read_link(home.join(".codex/auth.json")).unwrap(),
        home.join(".codex-a/auth.json")
    );
    assert_eq!(fs::read(app_config(home)).unwrap(), config_before);
}

#[test]
fn switching_accounts_is_refused_with_a_hand_written_provider() {
    let tmp = TempDir::new().unwrap();
    let home = tmp.path();
    write_account(home, "a");
    write_app_config(home, "model_provider = \"my-proxy\"\n");
    let config_before = fs::read(app_config(home)).unwrap();

    let error = switch_to_pat_account(home, "a").unwrap_err();

    assert_eq!(error.code, "APP_SLOT_CUSTOM_PROVIDER");
    assert!(fs::symlink_metadata(home.join(".codex/auth.json")).is_err());
    assert_eq!(fs::read(app_config(home)).unwrap(), config_before);
}
