use super::error::{AppError, Result};
use super::gateway::server::RequestLogMetadata;
use chrono::{DateTime, Utc};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::Path;

pub const MONITOR_RECORD_LIMIT: usize = 5000;
const MONITOR_READ_BYTES: u64 = 8 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestMonitorSnapshot {
    pub records: Vec<RequestLogMetadata>,
    pub provider_names: BTreeMap<String, String>,
    pub profile_names: BTreeMap<String, String>,
    pub earliest_recorded_at: Option<String>,
    pub read_at: String,
    pub legacy_records: usize,
    pub invalid_records: usize,
    pub pending_line: bool,
    pub truncated: bool,
    pub record_limit: usize,
}

pub fn query_request_monitor(home: &Path) -> Result<RequestMonitorSnapshot> {
    let path = super::lam_paths::LamPaths::for_home(home)
        .provider_hub_root()
        .join("gateway-requests.jsonl");
    let mut snapshot = read_request_monitor_at(&path)?;
    if snapshot.records.is_empty() {
        return Ok(snapshot);
    }
    for provider in super::provider_api_v2::list_provider_views_service_v2(home)? {
        snapshot
            .provider_names
            .insert(identity_hash(&provider.id), provider.name);
    }
    for binding in super::provider_api_v2::list_binding_views_service_v2(home)? {
        snapshot
            .profile_names
            .insert(identity_hash(&binding.profile_id), binding.profile_id);
    }
    Ok(snapshot)
}

fn identity_hash(value: &str) -> String {
    hex::encode(&Sha256::digest(value.as_bytes())[..8])
}

fn empty_snapshot() -> RequestMonitorSnapshot {
    RequestMonitorSnapshot {
        records: Vec::new(),
        provider_names: BTreeMap::new(),
        profile_names: BTreeMap::new(),
        earliest_recorded_at: None,
        read_at: Utc::now().to_rfc3339(),
        legacy_records: 0,
        invalid_records: 0,
        pending_line: false,
        truncated: false,
        record_limit: MONITOR_RECORD_LIMIT,
    }
}

pub fn read_request_monitor_at(path: &Path) -> Result<RequestMonitorSnapshot> {
    let mut snapshot = empty_snapshot();
    let (bytes, truncated) = read_log_tail(path)?;
    snapshot.truncated = truncated;
    snapshot.pending_line = !bytes.is_empty() && !bytes.ends_with(b"\n");
    let mut records = BTreeMap::new();
    for line in bytes
        .split_inclusive(|b| *b == b'\n')
        .filter(|line| line.ends_with(b"\n"))
    {
        read_record(line, &mut snapshot, &mut records);
    }
    snapshot.records = records.into_values().collect();
    snapshot.records.sort_by(|a, b| {
        b.started_at
            .cmp(&a.started_at)
            .then(b.record_id.cmp(&a.record_id))
    });
    snapshot.truncated |= snapshot.records.len() > MONITOR_RECORD_LIMIT;
    snapshot.records.truncate(MONITOR_RECORD_LIMIT);
    snapshot.earliest_recorded_at = snapshot.records.last().and_then(|r| r.started_at.clone());
    Ok(snapshot)
}

fn read_log_tail(path: &Path) -> Result<(Vec<u8>, bool)> {
    let mut file = match File::open(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok((Vec::new(), false))
        }
        Err(error) => return Err(monitor_read_error(error)),
    };
    let length = file.metadata().map_err(monitor_read_error)?.len();
    let start = length.saturating_sub(MONITOR_READ_BYTES);
    file.seek(SeekFrom::Start(start))
        .map_err(monitor_read_error)?;
    let mut bytes = Vec::new();
    file.take(MONITOR_READ_BYTES)
        .read_to_end(&mut bytes)
        .map_err(monitor_read_error)?;
    if start > 0 {
        let first_complete = bytes
            .iter()
            .position(|b| *b == b'\n')
            .map(|i| i + 1)
            .unwrap_or(bytes.len());
        bytes.drain(..first_complete);
    }
    Ok((bytes, start > 0))
}

fn read_record(
    line: &[u8],
    snapshot: &mut RequestMonitorSnapshot,
    records: &mut BTreeMap<String, RequestLogMetadata>,
) {
    let Ok(mut record) = serde_json::from_slice::<RequestLogMetadata>(line) else {
        snapshot.invalid_records += 1;
        return;
    };
    if record.schema_version != 2 {
        snapshot.legacy_records += 1;
        return;
    }
    if record.route != "/v1/responses" {
        return;
    }
    let Some(record_id) = record.record_id.clone().filter(|id| !id.is_empty()) else {
        snapshot.invalid_records += 1;
        return;
    };
    let Some(at) = record
        .started_at
        .as_deref()
        .and_then(|at| DateTime::parse_from_rfc3339(at).ok())
    else {
        snapshot.invalid_records += 1;
        return;
    };
    record.started_at = Some(
        at.with_timezone(&Utc)
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    );
    if let Some(usage) = record.usage.take() {
        record.usage = usage.validated();
    }
    records.insert(record_id, record);
}

fn monitor_read_error(error: std::io::Error) -> AppError {
    AppError::new(
        "MONITOR_READ_FAILED",
        format!("Request monitor log could not be read: {error}"),
    )
}
