use localagentmanager_core::{list_sessions, relay_resume_session, RelayResumeRequest};
use std::{fs, path::Path};

const SID: &str = "01a18659-28ca-71e3-85e9-6dd6307c6da2";
fn profile(home: &Path, id: &str, provider: &str, model: Option<&str>) -> std::path::PathBuf {
    let root = home.join(format!(".codex-{id}"));
    fs::create_dir_all(root.join("sessions/2026/11/03")).unwrap();
    fs::write(
        root.join("auth.json"),
        format!("{{\"token\":\"fixture-{id}\"}}"),
    )
    .unwrap();
    let model = model
        .map(|value| format!("model = {value:?}\n"))
        .unwrap_or_default();
    fs::write(
        root.join("config.toml"),
        format!("{model}model_provider = {provider:?}\n"),
    )
    .unwrap();
    root
}
fn request(model: Option<&str>) -> RelayResumeRequest {
    serde_json::from_value(serde_json::json!({"fromProfileId":"source","toProfileId":"target","sessionId":SID,"targetModel":model})).unwrap()
}
#[test]
fn handoff_projects_target_provider_and_model_in_both_directions_without_copying_auth() {
    for (source_provider, target_provider, source_model, target_model) in [
        ("account-pro", "openai", "group/api-model", "official-model"),
        ("openai", "account-api", "official-model", "api-model"),
        ("openai", "openai", "same-model", "same-model"),
        ("openai", "openai", "old-model", "target-model"),
    ] {
        let home = tempfile::tempdir().unwrap();
        let source = profile(home.path(), "source", source_provider, Some(source_model));
        let target = profile(home.path(), "target", target_provider, Some(target_model));
        let path = source.join("sessions/2026/11/03/fixture.jsonl");
        let body=format!("{{\"type\":\"session_meta\",\"payload\":{{\"id\":\"{SID}\",\"model_provider\":\"{source_provider}\"}}}}\n{{\"type\":\"turn_context\",\"payload\":{{\"model\":\"{source_model}\"}}}}\n");
        fs::write(&path, &body).unwrap();
        let original_auth = fs::read(target.join("auth.json")).unwrap();
        let result = relay_resume_session(home.path(), &request(None)).unwrap();
        let projected = fs::read_to_string(&result.target_path).unwrap();
        let meta: serde_json::Value =
            serde_json::from_str(projected.lines().next().unwrap()).unwrap();
        assert_eq!(meta["payload"]["model_provider"], target_provider);
        assert!(result
            .resume
            .command
            .contains(&format!("--model {target_model}")));
        assert_eq!(fs::read_to_string(&path).unwrap(), body);
        assert_eq!(fs::read(target.join("auth.json")).unwrap(), original_auth);
        assert!(projected.contains(source_model));
        assert_eq!(
            list_sessions(home.path(), "target")
                .unwrap()
                .iter()
                .find(|s| s.id == SID)
                .unwrap()
                .original_provider_id
                .as_deref(),
            Some(source_provider)
        );
        let again = relay_resume_session(home.path(), &request(None)).unwrap();
        assert_eq!(again.action, "already_current");
    }
}
#[test]
fn explicit_handoff_model_does_not_change_target_account_default() {
    let home = tempfile::tempdir().unwrap();
    let source = profile(home.path(), "source", "openai", Some("old-model"));
    let target = profile(home.path(), "target", "openai", Some("default-model"));
    fs::write(
        source.join("sessions/2026/11/03/fixture.jsonl"),
        format!("{{\"session_id\":\"{SID}\"}}\n"),
    )
    .unwrap();
    let before = fs::read(target.join("config.toml")).unwrap();
    let result = relay_resume_session(home.path(), &request(Some("chosen-model"))).unwrap();
    assert!(result.resume.command.contains("--model chosen-model"));
    assert_eq!(fs::read(target.join("config.toml")).unwrap(), before);
}
#[test]
fn an_unknown_target_default_requires_a_model_before_any_history_is_written() {
    let home = tempfile::tempdir().unwrap();
    let source = profile(home.path(), "source", "account-api", Some("api-model"));
    profile(home.path(), "target", "openai", None);
    fs::write(
        source.join("sessions/2026/11/03/fixture.jsonl"),
        format!("{{\"session_id\":\"{SID}\"}}\n"),
    )
    .unwrap();
    let error = relay_resume_session(home.path(), &request(None)).unwrap_err();
    assert_eq!(error.code, "HANDOFF_MODEL_REQUIRED");
    assert!(!home
        .path()
        .join(".codex-target/sessions/2026/11/03/fixture.jsonl")
        .exists());
}

#[test]
fn repairs_an_existing_copy_without_discarding_target_turns() {
    let home = tempfile::tempdir().unwrap();
    let source = profile(home.path(), "source", "account-api", Some("api-model"));
    let target = profile(home.path(), "target", "openai", Some("official-model"));
    let body = format!("{{\"type\":\"session_meta\",\"payload\":{{\"id\":\"{SID}\",\"model_provider\":\"account-api\"}}}}\n");
    let extra = "{\"type\":\"response_item\",\"payload\":{\"role\":\"user\",\"content\":\"target turn\"}}\n";
    fs::write(source.join("sessions/2026/11/03/fixture.jsonl"), &body).unwrap();
    let target_path = target.join("sessions/2026/11/03/fixture.jsonl");
    fs::write(&target_path, format!("{body}{extra}")).unwrap();
    let result = relay_resume_session(home.path(), &request(None)).unwrap();
    assert_eq!(result.action, "already_current");
    assert!(fs::read_to_string(result.backup_path.unwrap())
        .unwrap()
        .ends_with(extra));
    let repaired = fs::read_to_string(target_path).unwrap();
    assert!(repaired.ends_with(extra));
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(repaired.lines().next().unwrap()).unwrap()
            ["payload"]["model_provider"],
        "openai"
    );
}

#[test]
fn old_history_provider_also_requires_a_target_model_when_source_config_has_changed() {
    let home = tempfile::tempdir().unwrap();
    let source = profile(home.path(), "source", "openai", Some("official-model"));
    let target = profile(home.path(), "target", "openai", None);
    fs::write(source.join("sessions/2026/11/03/fixture.jsonl"), format!("{{\"type\":\"session_meta\",\"payload\":{{\"id\":\"{SID}\",\"model_provider\":\"account-api\"}}}}\n")).unwrap();
    let error = relay_resume_session(home.path(), &request(None)).unwrap_err();
    assert_eq!(error.code, "HANDOFF_MODEL_REQUIRED");
    assert!(!target.join("sessions/2026/11/03/fixture.jsonl").exists());
}

#[test]
fn invalid_model_is_rejected_before_copying_history() {
    let home = tempfile::tempdir().unwrap();
    let source = profile(home.path(), "source", "openai", Some("model"));
    let target = profile(home.path(), "target", "openai", Some("model"));
    fs::write(
        source.join("sessions/2026/11/03/fixture.jsonl"),
        format!("{{\"session_id\":\"{SID}\"}}\n"),
    )
    .unwrap();
    assert_eq!(
        relay_resume_session(home.path(), &request(Some("model\nother")))
            .unwrap_err()
            .code,
        "INVALID_HANDOFF_MODEL"
    );
    assert!(!target.join("sessions/2026/11/03/fixture.jsonl").exists());
}

#[test]
fn diverged_summary_ignores_runtime_binding_when_finding_shared_history() {
    let home = tempfile::tempdir().unwrap();
    let source = profile(home.path(), "source", "account-api", Some("api-model"));
    let target = profile(home.path(), "target", "openai", Some("official-model"));
    let source_header = format!("{{\"type\":\"session_meta\",\"payload\":{{\"id\":\"{SID}\",\"model_provider\":\"account-api\"}}}}\n");
    let target_header = format!("{{\"type\":\"session_meta\",\"payload\":{{\"id\":\"{SID}\",\"model_provider\":\"openai\",\"lam_original_model_provider\":\"account-api\"}}}}\n");
    fs::write(
        source.join("sessions/2026/11/03/fixture.jsonl"),
        format!("{source_header}{{\"branch\":\"source\"}}\n"),
    )
    .unwrap();
    let target_path = target.join("sessions/2026/11/03/fixture.jsonl");
    let target_body = format!("{target_header}{{\"branch\":\"target\"}}\n");
    fs::write(&target_path, &target_body).unwrap();
    let mut req = request(None);
    req.diverged_strategy = Some("summarize_fork_with_target_account".into());
    let result = relay_resume_session(home.path(), &req).unwrap();
    let material = fs::read_to_string(result.handoff_path.unwrap()).unwrap();
    assert!(material.contains("Common prefix lines: 1"));
    assert!(material.contains("Source branch lines: 1"));
    assert!(material.contains("Target branch lines: 1"));
    assert_eq!(fs::read_to_string(target_path).unwrap(), target_body);
    assert_eq!(
        result
            .resume
            .command
            .matches("--model official-model")
            .count(),
        1
    );
}

fn index(root: &Path, provider: &str) -> rusqlite::Connection {
    let db = rusqlite::Connection::open(root.join("state_5.sqlite")).unwrap();
    db.execute_batch("CREATE TABLE threads(id TEXT PRIMARY KEY, model_provider TEXT NOT NULL, title TEXT, model TEXT);").unwrap();
    for id in [SID, "unrelated-thread"] {
        db.execute(
            "INSERT INTO threads VALUES (?1, ?2, 'keep title', 'keep model')",
            rusqlite::params![id, provider],
        )
        .unwrap();
    }
    db
}

#[test]
fn existing_target_index_uses_target_provider_without_changing_other_thread_data() {
    for (source_provider, target_provider) in [("account-api", "openai"), ("openai", "account-api")]
    {
        let home = tempfile::tempdir().unwrap();
        let source = profile(home.path(), "source", source_provider, Some("source-model"));
        let target = profile(home.path(), "target", target_provider, Some("target-model"));
        let source_db = index(&source, source_provider);
        let target_db = index(&target, source_provider);
        let body = format!("{{\"type\":\"session_meta\",\"payload\":{{\"id\":\"{SID}\",\"model_provider\":\"{source_provider}\"}}}}\n");
        fs::write(source.join("sessions/2026/11/03/fixture.jsonl"), body).unwrap();
        for _ in 0..2 {
            target_db
                .execute(
                    "UPDATE threads SET model_provider=?1 WHERE id=?2",
                    rusqlite::params![source_provider, SID],
                )
                .unwrap();
            relay_resume_session(home.path(), &request(None)).unwrap();
            let values: (String, String, String) = target_db
                .query_row(
                    "SELECT model_provider, title, model FROM threads WHERE id=?1",
                    [SID],
                    |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
                )
                .unwrap();
            assert_eq!(
                values,
                (
                    target_provider.into(),
                    "keep title".into(),
                    "keep model".into()
                )
            );
            for db in [&source_db, &target_db] {
                let unrelated: String = db
                    .query_row(
                        "SELECT model_provider FROM threads WHERE id='unrelated-thread'",
                        [],
                        |r| r.get(0),
                    )
                    .unwrap();
                assert_eq!(unrelated, source_provider);
            }
            let original: String = source_db
                .query_row(
                    "SELECT model_provider FROM threads WHERE id=?1",
                    [SID],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(original, source_provider);
        }
    }
}

#[test]
fn corrupt_target_index_returns_an_explicit_error_instead_of_a_launch_command() {
    let home = tempfile::tempdir().unwrap();
    let source = profile(home.path(), "source", "account-api", Some("source-model"));
    let target = profile(home.path(), "target", "openai", Some("target-model"));
    fs::write(
        source.join("sessions/2026/11/03/fixture.jsonl"),
        format!("{{\"session_id\":\"{SID}\"}}\n"),
    )
    .unwrap();
    fs::write(target.join("state_5.sqlite"), "corrupt fixture").unwrap();
    assert_eq!(
        relay_resume_session(home.path(), &request(None))
            .unwrap_err()
            .code,
        "CODEX_SESSION_DB_ERROR"
    );
    assert_eq!(
        fs::read_to_string(target.join("state_5.sqlite")).unwrap(),
        "corrupt fixture"
    );
}

#[test]
fn handoff_does_not_create_missing_index_records_or_a_missing_database() {
    for create_db in [false, true] {
        let home = tempfile::tempdir().unwrap();
        let source = profile(home.path(), "source", "account-api", Some("source-model"));
        let target = profile(home.path(), "target", "openai", Some("target-model"));
        fs::write(
            source.join("sessions/2026/11/03/fixture.jsonl"),
            format!("{{\"session_id\":\"{SID}\"}}\n"),
        )
        .unwrap();
        let db = create_db.then(|| index(&target, "account-api"));
        if let Some(db) = &db {
            db.execute("DELETE FROM threads WHERE id=?1", [SID])
                .unwrap();
        }
        relay_resume_session(home.path(), &request(None)).unwrap();
        assert_eq!(target.join("state_5.sqlite").exists(), create_db);
        if let Some(db) = db {
            assert_eq!(
                db.query_row("SELECT count(*) FROM threads", [], |r| r.get::<_, i64>(0))
                    .unwrap(),
                1
            );
        }
    }
}

#[test]
fn locked_target_index_returns_an_explicit_error_without_overwriting_it() {
    let home = tempfile::tempdir().unwrap();
    let source = profile(home.path(), "source", "account-api", Some("source-model"));
    let target = profile(home.path(), "target", "openai", Some("target-model"));
    fs::write(
        source.join("sessions/2026/11/03/fixture.jsonl"),
        format!("{{\"session_id\":\"{SID}\"}}\n"),
    )
    .unwrap();
    let db = index(&target, "account-api");
    db.execute_batch("BEGIN IMMEDIATE").unwrap();
    assert_eq!(
        relay_resume_session(home.path(), &request(None))
            .unwrap_err()
            .code,
        "CODEX_SESSION_DB_ERROR"
    );
    db.execute_batch("ROLLBACK").unwrap();
    assert_eq!(
        db.query_row(
            "SELECT model_provider FROM threads WHERE id=?1",
            [SID],
            |r| r.get::<_, String>(0)
        )
        .unwrap(),
        "account-api"
    );
}
