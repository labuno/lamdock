use localagentmanager_core::request_monitor::{read_request_monitor_at, MONITOR_RECORD_LIMIT};
use serde_json::json;
use std::fs;

fn record(id: &str, at: &str) -> serde_json::Value {
    json!({"schemaVersion":2,"recordId":id,"requestId":id,"startedAt":at,"route":"/v1/responses",
        "status":200,"latencyMs":120,"bindingHash":"b","providerHash":"p","capacityHash":"c",
        "queueWaitMs":0,"queuedBodyBytes":0,"globalRunning":0,"globalQueued":0,
        "bindingRunning":0,"bindingQueued":0,"activeStreams":0,"retryCount":0,
        "usage":{"inputTokens":10,"outputTokens":2,"totalTokens":12}})
}

#[test]
fn absent_log_is_empty_observation_and_read_errors_are_explicit() {
    let root = tempfile::tempdir().unwrap();
    let empty = read_request_monitor_at(&root.path().join("absent")).unwrap();
    assert!(empty.records.is_empty());
    assert!(empty.earliest_recorded_at.is_none());
    assert!(read_request_monitor_at(root.path()).is_err());
}

#[test]
fn deduplicates_requests_excludes_legacy_timing_and_exposes_corruption() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("requests.jsonl");
    let mut legacy = record("old", "2026-10-24T00:00:00Z");
    legacy.as_object_mut().unwrap().remove("schemaVersion");
    legacy["ttftMs"] = 1.into();
    let one = record("one", "2026-10-25T00:00:00Z");
    let mut update = one.clone();
    update["streamState"] = "completed".into();
    let two = record("two", "2026-10-26T00:00:00Z");
    fs::write(
        &path,
        format!("{legacy}\n{one}\n{update}\nBROKEN\n{two}\n{{\"pending\":"),
    )
    .unwrap();
    let snapshot = read_request_monitor_at(&path).unwrap();
    assert_eq!(snapshot.records.len(), 2);
    assert_eq!(snapshot.records[0].request_id, "two");
    assert_eq!(
        snapshot.records[1].stream_state.as_deref(),
        Some("completed")
    );
    assert_eq!(
        snapshot.records[0]
            .usage
            .as_ref()
            .unwrap()
            .cached_input_tokens,
        None
    );
    assert_eq!(snapshot.legacy_records, 1);
    assert_eq!(snapshot.invalid_records, 1);
    assert!(snapshot.pending_line);
    assert_eq!(
        snapshot.earliest_recorded_at.as_deref(),
        Some("2026-10-25T00:00:00.000Z")
    );
}

#[test]
fn limits_results_and_rejects_unusable_v2_timestamps() {
    let root = tempfile::tempdir().unwrap();
    let path = root.path().join("requests.jsonl");
    let mut rows = (0..MONITOR_RECORD_LIMIT + 1)
        .map(|i| record(&format!("r{i:05}"), "2026-10-26T00:00:00Z").to_string())
        .collect::<Vec<_>>();
    rows.push(record("bad", "not-a-date").to_string());
    fs::write(&path, rows.join("\n") + "\n").unwrap();
    let snapshot = read_request_monitor_at(&path).unwrap();
    assert_eq!(snapshot.records.len(), MONITOR_RECORD_LIMIT);
    assert!(snapshot.truncated);
    assert_eq!(snapshot.invalid_records, 1);
}
