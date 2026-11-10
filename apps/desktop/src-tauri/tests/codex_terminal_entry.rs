use localagentmanager_core::{
    execute_create_account, repair_codex_command, update_account_proxy, CreateAccountRequest,
    UpdateAccountProxyRequest,
};
use std::os::unix::fs::{symlink, PermissionsExt};
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};
use tempfile::TempDir;

fn executable(path: &Path, source: &str) {
    fs::write(path, source).unwrap();
    fs::set_permissions(path, fs::Permissions::from_mode(0o755)).unwrap();
}

fn fixture() -> TempDir {
    let root = TempDir::new().unwrap();
    for path in [".local/bin", "vendor", ".codex"] {
        fs::create_dir_all(root.path().join(path)).unwrap();
    }
    fs::write(root.path().join(".codex/config.toml"), "model = \"test\"\n").unwrap();
    executable(&root.path().join("vendor/codex"), "#!/bin/bash\nprintf '%s\\n' \"${CODEX_HOME-unset}\" \"${HTTPS_PROXY-unset}\" \"${HTTP_PROXY-unset}\" \"${https_proxy-unset}\" \"${NO_PROXY-unset}\"\nprintf 'ARG=%s\\n' \"$@\"\nexit 23\n");
    root
}

fn save(root: &Path, id: &str, enabled: bool, port: u16) {
    update_account_proxy(
        root,
        &UpdateAccountProxyRequest {
            profile_id: id.into(),
            enabled,
            url: format!("http://127.0.0.1:{port}"),
        },
    )
    .unwrap();
}

fn entry(root: &Path) -> PathBuf {
    root.join(".local/bin/codex")
}

fn command(root: &Path) -> Command {
    let mut command = Command::new("/bin/bash");
    command
        .env_clear()
        .env("HOME", root)
        .env("LAM_HOME", root)
        .env(
            "PATH",
            format!(
                "{}:{}:{}:/usr/bin:/bin",
                root.join(".local/bin").display(),
                root.join(".local/bin").display(),
                root.join("vendor").display()
            ),
        )
        .env("HTTPS_PROXY", "http://inherited:7897")
        .env("NO_PROXY", "*");
    command
}

fn assert_main_proxy(output: Output, port: u16) -> String {
    assert_eq!(
        output.status.code(),
        Some(23),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let text = String::from_utf8(output.stdout).unwrap();
    let lines: Vec<_> = text.lines().collect();
    assert!(lines[0].ends_with("/.codex"));
    assert_eq!(lines[1], format!("http://127.0.0.1:{port}"));
    assert_eq!(lines[2], lines[1]);
    assert_eq!(lines[3], lines[1]);
    assert_eq!(lines[4], "localhost,127.0.0.1,::1");
    text
}

#[test]
fn plain_codex_loads_main_proxy_and_keeps_original_program_arguments_and_exit_code() {
    let root = fixture();
    let original = fs::read(root.path().join("vendor/codex")).unwrap();
    repair_codex_command(root.path()).unwrap();
    save(root.path(), "main", true, 17891);
    let output = command(root.path())
        .args(["-c", "codex resume 'a session' 'literal; value'"])
        .output()
        .unwrap();
    let text = assert_main_proxy(output, 17891);
    assert!(text.contains("ARG=resume\nARG=a session\nARG=literal; value\n"));
    assert_eq!(
        fs::read(root.path().join("vendor/codex")).unwrap(),
        original
    );
}

#[test]
fn settings_are_read_on_every_launch_and_disabled_keeps_inherited_proxy() {
    let root = fixture();
    repair_codex_command(root.path()).unwrap();
    let run = || {
        command(root.path())
            .args(["-c", "codex --version"])
            .output()
            .unwrap()
    };
    let initial = run();
    assert_eq!(initial.status.code(), Some(23));
    assert!(String::from_utf8(initial.stdout)
        .unwrap()
        .contains("http://inherited:7897"));
    save(root.path(), "main", true, 17891);
    assert_main_proxy(run(), 17891);
    save(root.path(), "main", true, 17892);
    assert_main_proxy(run(), 17892);
    save(root.path(), "main", false, 17892);
    let disabled = String::from_utf8(run().stdout).unwrap();
    assert!(disabled.contains("http://inherited:7897"));
    assert!(disabled.lines().any(|line| line == "*"));
}

#[test]
fn named_wrapper_and_explicit_codex_home_use_their_own_account() {
    let root = fixture();
    let account = execute_create_account(
        root.path(),
        &CreateAccountRequest {
            name: "luna002".into(),
            copy_config_from: None,
            overwrite_wrapper: false,
        },
    )
    .unwrap();
    repair_codex_command(root.path()).unwrap();
    save(root.path(), "main", true, 17891);
    save(root.path(), "luna002", true, 17892);
    for invocation in [
        format!("'{}' resume 'a session'", account.wrapper_path.display()),
        "CODEX_HOME=\"$HOME/.codex-luna002\" codex resume 'a session'".into(),
    ] {
        let output = command(root.path())
            .args(["-c", &invocation])
            .output()
            .unwrap();
        assert_eq!(
            output.status.code(),
            Some(23),
            "{}",
            String::from_utf8_lossy(&output.stderr)
        );
        let text = String::from_utf8(output.stdout).unwrap();
        let lines: Vec<_> = text.lines().collect();
        assert!(lines[0].ends_with("/.codex-luna002"));
        assert_eq!(lines[1], "http://127.0.0.1:17892");
        assert!(text.contains("ARG=a session"));
    }
}

#[test]
fn external_codex_home_does_not_borrow_main_proxy_and_explicit_binary_is_supported() {
    let root = fixture();
    repair_codex_command(root.path()).unwrap();
    save(root.path(), "main", true, 17891);
    let output = command(root.path())
        .env("CODEX_HOME", root.path().join("external profile"))
        .args(["-c", "codex"])
        .output()
        .unwrap();
    assert_eq!(output.status.code(), Some(23));
    assert!(String::from_utf8(output.stdout)
        .unwrap()
        .contains("http://inherited:7897"));
    let output = command(root.path())
        .env("CODEX_BIN", root.path().join("vendor/codex"))
        .env("PATH", "/usr/bin:/bin")
        .arg(entry(root.path()))
        .output()
        .unwrap();
    assert_main_proxy(output, 17891);
}

#[test]
fn missing_binary_recursive_override_and_corrupt_settings_fail_explicitly() {
    let root = fixture();
    repair_codex_command(root.path()).unwrap();
    let recursive = command(root.path())
        .env("CODEX_BIN", entry(root.path()))
        .arg(entry(root.path()))
        .output()
        .unwrap();
    assert_eq!(recursive.status.code(), Some(126));
    fs::remove_file(root.path().join("vendor/codex")).unwrap();
    let missing = command(root.path()).args(["-c", "codex"]).output().unwrap();
    assert_eq!(missing.status.code(), Some(127));
    save(root.path(), "main", true, 17891);
    fs::write(
        root.path().join(".lam/config/account-proxies/main.json"),
        "broken",
    )
    .unwrap();
    let invalid = command(root.path())
        .env("CODEX_BIN", "/bin/true")
        .arg(entry(root.path()))
        .output()
        .unwrap();
    assert!(!invalid.status.success());
}

#[test]
fn installer_is_idempotent_and_only_repairs_owned_files() {
    let root = fixture();
    let expected = entry(root.path());
    assert_eq!(
        repair_codex_command(root.path()).unwrap(),
        Some(expected.clone())
    );
    assert_eq!(
        fs::metadata(&expected).unwrap().permissions().mode() & 0o777,
        0o755
    );
    assert_eq!(repair_codex_command(root.path()).unwrap(), None);
    let source = fs::read_to_string(&expected).unwrap();
    fs::write(&expected, format!("{source}\n# stale")).unwrap();
    assert_eq!(
        repair_codex_command(root.path()).unwrap(),
        Some(expected.clone())
    );
    assert_eq!(fs::read_to_string(&expected).unwrap(), source);
}

#[test]
fn installer_preserves_user_commands_and_symlink_targets() {
    let root = fixture();
    let target = root.path().join("vendor/codex");
    let original = fs::read(&target).unwrap();
    symlink(&target, entry(root.path())).unwrap();
    assert_eq!(
        repair_codex_command(root.path()).unwrap_err().code,
        "CODEX_COMMAND_CONFLICT"
    );
    assert_eq!(fs::read(&target).unwrap(), original);
    fs::remove_file(entry(root.path())).unwrap();
    executable(&entry(root.path()), "#!/bin/sh\nexit 9\n");
    assert_eq!(
        repair_codex_command(root.path()).unwrap_err().code,
        "CODEX_COMMAND_CONFLICT"
    );
    assert_eq!(
        fs::read_to_string(entry(root.path())).unwrap(),
        "#!/bin/sh\nexit 9\n"
    );
    let error = update_account_proxy(
        root.path(),
        &UpdateAccountProxyRequest {
            profile_id: "main".into(),
            enabled: true,
            url: "http://127.0.0.1:17891".into(),
        },
    )
    .unwrap_err();
    assert_eq!(error.code, "CODEX_COMMAND_CONFLICT");
    assert!(!root
        .path()
        .join(".lam/config/account-proxies/main.json")
        .exists());
}

#[test]
fn no_main_account_does_not_install_a_command() {
    let root = TempDir::new().unwrap();
    assert_eq!(repair_codex_command(root.path()).unwrap(), None);
    assert!(!entry(root.path()).exists());
}

#[test]
fn cmux_outer_shim_runs_once_and_preserves_its_injection_without_entry_recursion() {
    use std::os::unix::process::CommandExt;
    use std::process::Stdio;
    use std::time::{Duration, Instant};

    let root = fixture();
    repair_codex_command(root.path()).unwrap();
    save(root.path(), "main", true, 17891);
    let shim_dir = root.path().join("cmux-cli-shims/session");
    fs::create_dir_all(&shim_dir).unwrap();
    executable(
        &shim_dir.join("codex"),
        r#"#!/bin/bash
export CMUX_CODEX_WRAPPER_SHIM="$0"
printf 'once\n' >> "$HOME/cmux-calls"
exec "$HOME/.local/bin/codex" -c 'cmux_config=kept' "$@"
"#,
    );
    let path = format!(
        "{}:{}:{}:/usr/bin:/bin",
        shim_dir.display(),
        root.path().join(".local/bin").display(),
        root.path().join("vendor").display()
    );
    let mut child = command(root.path())
        .env("PATH", path)
        .args(["-c", "exec codex resume 'a session'"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .process_group(0)
        .spawn()
        .unwrap();
    let deadline = Instant::now() + Duration::from_secs(3);
    while child.try_wait().unwrap().is_none() {
        if Instant::now() >= deadline {
            unsafe {
                libc::kill(-(child.id() as i32), libc::SIGKILL);
            }
            let _ = child.wait();
            panic!("cmux and LAM entries recursively call each other");
        }
        std::thread::sleep(Duration::from_millis(10));
    }
    let text = assert_main_proxy(child.wait_with_output().unwrap(), 17891);
    assert!(text.contains("ARG=cmux_config=kept\nARG=resume\nARG=a session\n"));
    assert_eq!(
        fs::read_to_string(root.path().join("cmux-calls")).unwrap(),
        "once\n"
    );
}
