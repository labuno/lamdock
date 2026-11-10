use localagentmanager_core::gateway::monitoring::ResponseMetrics;
use localagentmanager_core::gateway::server::RequestUsageMetadata;
use serde_json::json;

fn event(kind: &str, fields: serde_json::Value) -> Vec<u8> {
    let mut value = fields;
    value["type"] = kind.into();
    format!("event: {kind}\r\ndata: {value}\r\n\r\n").into_bytes()
}

#[test]
fn headers_heartbeats_and_empty_metadata_do_not_count_as_first_content() {
    let mut metrics = ResponseMetrics::default();
    metrics.push(b": keepalive\n\n", 10);
    metrics.push(
        &event("response.created", json!({"response":{"id":"r"}})),
        20,
    );
    metrics.push(
        &event("response.output_text.delta", json!({"delta":""})),
        30,
    );
    assert_eq!(metrics.first_content_ms, None);
    let bytes = event(
        "response.reasoning_summary_text.delta",
        json!({"delta":"思考"}),
    );
    for byte in bytes {
        metrics.push(&[byte], 120);
    }
    metrics.push(
        &event("response.output_text.delta", json!({"delta":"text"})),
        170,
    );
    assert_eq!(metrics.first_content_ms, Some(120));
}

#[test]
fn terminal_usage_preserves_explicit_zero_cache_and_unknown_fields() {
    let mut metrics = ResponseMetrics::default();
    metrics.push(
        &event(
            "response.completed",
            json!({"response":{"usage":{
                "input_tokens":10,"output_tokens":4,"total_tokens":14,
                "input_tokens_details":{"cached_tokens":0},
                "output_tokens_details":{"reasoning_tokens":2}
            }}}),
        ),
        150,
    );
    assert_eq!(metrics.terminal.as_deref(), Some("completed"));
    let usage = metrics.usage.unwrap();
    assert_eq!(usage.input_tokens, Some(10));
    assert_eq!(usage.cached_input_tokens, Some(0));
    assert_eq!(usage.reasoning_output_tokens, Some(2));
    assert_eq!(metrics.first_content_ms, None);

    let partial =
        RequestUsageMetadata::from_responses(&json!({"usage":{"input_tokens":5}})).unwrap();
    assert_eq!(partial.input_tokens, Some(5));
    assert_eq!(partial.output_tokens, None);
    assert_eq!(partial.total_tokens, None);
    assert_eq!(partial.cached_input_tokens, None);
    assert!(RequestUsageMetadata::from_responses(&json!({"usage":null})).is_none());
    assert!(RequestUsageMetadata::from_responses(&json!({"usage":{
        "input_tokens":5,"output_tokens":2,"total_tokens":99
    }}))
    .is_none());
}

#[test]
fn tool_content_and_failure_are_observed_without_inventing_usage() {
    let mut metrics = ResponseMetrics::default();
    metrics.push(
        &event(
            "response.function_call_arguments.delta",
            json!({"delta":"{"}),
        ),
        22,
    );
    metrics.push(
        &event(
            "response.failed",
            json!({"response":{"error":{"message":"secret"}}}),
        ),
        60,
    );
    assert_eq!(metrics.first_content_ms, Some(22));
    assert_eq!(metrics.terminal.as_deref(), Some("failed"));
    assert_eq!(metrics.usage, None);
}
