#[path = "../src/startup.rs"]
mod startup;
use std::fs;
use std::os::unix::fs::PermissionsExt;

#[test]
fn a_fresh_workspace_starts_without_a_reported_issue() {
    let home = tempfile::tempdir().unwrap();
    assert!(startup::initialize(home.path()).issue.is_none());
}

#[test]
fn invalid_provider_data_is_reported_without_deleting_or_replacing_it() {
    let home = tempfile::tempdir().unwrap();
    let root = home.path().join(".lam/provider-hub");
    fs::create_dir_all(&root).unwrap();
    let path = root.join("providers.json");
    let invalid = b"{ invalid provider data";
    fs::write(&path, invalid).unwrap();
    fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).unwrap();
    let report = startup::initialize(home.path());
    assert!(report
        .issue
        .as_ref()
        .is_some_and(|issue| issue.contains("Startup maintenance")));
    assert_eq!(fs::read(path).unwrap(), invalid);
}
