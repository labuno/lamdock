use localagentmanager_core::{
    build_login_command, build_resume_command, execute_create_account, update_account_proxy,
    CreateAccountRequest, ResumeCommandRequest, UpdateAccountProxyRequest,
};
use std::{fs, path::Path, process::Command};
use tempfile::TempDir;

fn fixture() -> (TempDir, std::path::PathBuf) {
    let root = TempDir::new().unwrap();
    let account = execute_create_account(
        root.path(),
        &CreateAccountRequest {
            name: "sg".into(),
            copy_config_from: None,
            overwrite_wrapper: false,
        },
    )
    .unwrap();
    let bin = root.path().join("bin");
    fs::create_dir_all(&bin).unwrap();
    let fake = bin.join("codex");
    fs::write(&fake, "#!/bin/sh\nprintf '%s\\n' \"${HTTP_PROXY-unset}\" \"${HTTPS_PROXY-unset}\" \"${ALL_PROXY-unset}\" \"${http_proxy-unset}\" \"${https_proxy-unset}\" \"${all_proxy-unset}\" \"${NO_PROXY-unset}\" \"${no_proxy-unset}\" \"$CODEX_HOME\" \"$*\"\nexit 23\n").unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&fake, fs::Permissions::from_mode(0o700)).unwrap();
    }
    (root, account.wrapper_path)
}

fn set_proxy(root: &Path, enabled: bool) {
    update_account_proxy(
        root,
        &UpdateAccountProxyRequest {
            profile_id: "sg".into(),
            enabled,
            url: "http://127.0.0.1:17891".into(),
        },
    )
    .unwrap();
}

fn run(root: &Path, shell: &str) -> std::process::Output {
    let path = format!("{}:/usr/bin:/bin", root.join("bin").display());
    Command::new("/bin/bash")
        .args(["-c", shell])
        .env_clear()
        .env("HOME", root)
        .env("LAM_HOME", root)
        .env("PATH", path)
        .env("CODEX_BIN", root.join("bin/codex"))
        .env("HTTPS_PROXY", "http://inherited:7897")
        .env("NO_PROXY", "*")
        .output()
        .unwrap()
}

fn assert_proxy(output: std::process::Output) {
    assert_eq!(
        output.status.code(),
        Some(23),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let text = String::from_utf8(output.stdout).unwrap();
    let lines: Vec<_> = text.lines().collect();
    assert_eq!(&lines[..6], &["http://127.0.0.1:17891"; 6]);
    assert_eq!(lines[6], "localhost,127.0.0.1,::1");
    assert_eq!(lines[7], lines[6]);
    assert!(lines[8].ends_with(".codex-sg"));
}

#[test]
fn wrapper_reads_current_setting_and_disabled_preserves_inherited_network() {
    let (root, wrapper) = fixture();
    let command = format!("'{}' resume 'a session'", wrapper.display());
    let initial = run(root.path(), &command);
    assert!(String::from_utf8(initial.stdout)
        .unwrap()
        .contains("http://inherited:7897"));
    set_proxy(root.path(), true);
    assert_proxy(run(root.path(), &command));
    set_proxy(root.path(), false);
    let disabled = String::from_utf8(run(root.path(), &command).stdout).unwrap();
    assert!(disabled.contains("http://inherited:7897"));
    assert!(disabled.lines().any(|line| line == "*"));
}

#[test]
fn resume_and_login_use_account_proxy_and_keep_codex_arguments() {
    let (root, _) = fixture();
    set_proxy(root.path(), true);
    let resume = build_resume_command(
        root.path(),
        &ResumeCommandRequest {
            profile_id: "sg".into(),
            session_id: Some("a session".into()),
            cwd: None,
        },
    )
    .unwrap();
    let output = run(root.path(), &resume.command);
    assert!(String::from_utf8_lossy(&output.stdout).contains("resume a session"));
    assert_proxy(output);
    let login = build_login_command(root.path(), "sg").unwrap();
    assert_proxy(run(root.path(), &login.command));
}

#[test]
fn corrupted_wrapper_setting_fails_instead_of_launching_without_proxy() {
    let (root, wrapper) = fixture();
    set_proxy(root.path(), true);
    fs::write(
        root.path().join(".lam/config/account-proxies/sg.json"),
        "broken",
    )
    .unwrap();
    let output = run(root.path(), &format!("'{}'", wrapper.display()));
    assert!(!output.status.success());
    assert_ne!(output.status.code(), Some(23));
}

#[test]
fn lam_cli_applies_profile_proxy_without_requiring_gateway_components() {
    let (root, _) = fixture();
    set_proxy(root.path(), true);
    let output = Command::new(env!("CARGO_BIN_EXE_lam"))
        .args(["codex", "--profile", "sg", "--", "resume", "a session"])
        .env_clear()
        .env("HOME", root.path())
        .env("LAM_HOME", root.path())
        .env("LAM_CODEX_EXECUTABLE", root.path().join("bin/codex"))
        .env("PATH", "/usr/bin:/bin")
        .current_dir(root.path())
        .output()
        .unwrap();
    assert_proxy(output);
}
