use super::error::{AppError, Result};
use serde_json::Value;
use std::path::Path;

pub(crate) fn sync_thread_provider(home: &Path, session_id: &str, provider: &str) -> Result<()> {
    let path = home.join("state_5.sqlite");
    if !path.exists() {
        return Ok(());
    }
    sync_existing_thread_provider(&path, session_id, provider)
        .map_err(|error| AppError::new("CODEX_SESSION_DB_ERROR", error.to_string()))
}

fn sync_existing_thread_provider(
    path: &Path,
    session_id: &str,
    provider: &str,
) -> rusqlite::Result<()> {
    let db =
        rusqlite::Connection::open_with_flags(path, rusqlite::OpenFlags::SQLITE_OPEN_READ_WRITE)?;
    db.busy_timeout(std::time::Duration::from_secs(5))?;
    let has_threads: bool = db.query_row(
        "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type='table' AND name='threads')",
        [],
        |row| row.get(0),
    )?;
    if !has_threads {
        return Ok(());
    }
    // Codex can use this cached binding even after the rollout header is projected.
    db.execute(
        "UPDATE threads SET model_provider=?1 WHERE id=?2 AND model_provider<>?1",
        rusqlite::params![provider, session_id],
    )?;
    Ok(())
}

fn header(bytes: &[u8]) -> Result<(Value, &[u8])> {
    let end = bytes
        .iter()
        .position(|byte| *byte == b'\n')
        .unwrap_or(bytes.len());
    let value = serde_json::from_slice(&bytes[..end])
        .map_err(|error| AppError::new("SESSION_METADATA_INVALID", error.to_string()))?;
    Ok((value, &bytes[end..]))
}

fn join_header(value: &Value, rest: &[u8]) -> Result<Vec<u8>> {
    let mut bytes = serde_json::to_vec(value)
        .map_err(|error| AppError::new("SESSION_METADATA_INVALID", error.to_string()))?;
    bytes.extend_from_slice(rest);
    Ok(bytes)
}

pub(crate) fn project_history(bytes: &[u8], provider: &str) -> Result<Vec<u8>> {
    let (mut value, rest) = header(bytes)?;
    if value["type"] != "session_meta" {
        return Ok(bytes.to_vec());
    }
    let payload = value["payload"].as_object_mut().ok_or_else(|| {
        AppError::new(
            "SESSION_METADATA_INVALID",
            "session_meta payload must be an object",
        )
    })?;
    let original = payload
        .get("model_provider")
        .and_then(Value::as_str)
        .unwrap_or("openai")
        .to_owned();
    if original == provider {
        return Ok(bytes.to_vec());
    }
    payload
        .entry("lam_original_model_provider")
        .or_insert(Value::String(original));
    payload.insert("model_provider".into(), Value::String(provider.into()));
    join_header(&value, rest)
}

pub(crate) fn history_identity(bytes: &[u8]) -> Result<Vec<u8>> {
    let (mut value, rest) = header(bytes)?;
    if value["type"] != "session_meta" {
        return Ok(bytes.to_vec());
    }
    if let Some(payload) = value["payload"].as_object_mut() {
        payload.remove("model_provider");
        payload.remove("lam_original_model_provider");
    }
    join_header(&value, rest)
}
