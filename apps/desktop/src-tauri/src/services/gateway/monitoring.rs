//! Reads metadata from outgoing Responses SSE without changing forwarded bytes.
use super::server::RequestUsageMetadata;
use serde_json::Value;

#[derive(Default)]
pub struct ResponseMetrics {
    pending: Vec<u8>,
    disabled: bool,
    pub first_content_ms: Option<u64>,
    pub usage: Option<RequestUsageMetadata>,
    pub terminal: Option<String>,
}

impl ResponseMetrics {
    pub fn push(&mut self, bytes: &[u8], elapsed_ms: u64) {
        if self.disabled || self.terminal.is_some() {
            return;
        }
        for byte in bytes {
            self.pending.push(*byte);
            if self.pending.ends_with(b"\n\n") || self.pending.ends_with(b"\r\n\r\n") {
                let frame = std::mem::take(&mut self.pending);
                self.frame(&frame, elapsed_ms);
                if self.terminal.is_some() {
                    return;
                }
            }
            // Oversized events cannot be interpreted reliably. Forwarding continues.
            if self.pending.len() > 256 * 1024 {
                self.pending.clear();
                self.disabled = true;
                return;
            }
        }
    }

    fn frame(&mut self, frame: &[u8], elapsed_ms: u64) {
        let Ok(frame) = std::str::from_utf8(frame) else {
            return;
        };
        let data = frame
            .lines()
            .filter_map(|line| line.strip_prefix("data:"))
            .map(|line| line.strip_prefix(' ').unwrap_or(line))
            .collect::<Vec<_>>()
            .join("\n");
        let Ok(value) = serde_json::from_str::<Value>(&data) else {
            return;
        };
        let kind = value["type"].as_str().unwrap_or("");
        if is_content_delta(kind) && value["delta"].as_str().is_some_and(|text| !text.is_empty()) {
            self.first_content_ms.get_or_insert(elapsed_ms);
        }
        let terminal = match kind {
            "response.completed" => "completed",
            "response.incomplete" => "incomplete",
            "response.failed" | "error" => "failed",
            _ => return,
        };
        self.terminal = Some(terminal.into());
        self.usage = RequestUsageMetadata::from_responses(&value["response"]);
    }
}

fn is_content_delta(kind: &str) -> bool {
    matches!(
        kind,
        "response.output_text.delta"
            | "response.reasoning_text.delta"
            | "response.reasoning_summary_text.delta"
            | "response.function_call_arguments.delta"
            | "response.custom_tool_call_input.delta"
            | "response.refusal.delta"
    )
}

impl RequestUsageMetadata {
    pub fn from_responses(value: &Value) -> Option<Self> {
        let usage = value.get("usage")?.as_object()?;
        let count = |key: &str| usage.get(key).and_then(Value::as_u64);
        let result = Self {
            input_tokens: count("input_tokens"),
            output_tokens: count("output_tokens"),
            total_tokens: count("total_tokens"),
            cached_input_tokens: usage
                .get("input_tokens_details")
                .and_then(|v| v.get("cached_tokens"))
                .and_then(Value::as_u64),
            reasoning_output_tokens: usage
                .get("output_tokens_details")
                .and_then(|v| v.get("reasoning_tokens"))
                .and_then(Value::as_u64),
        };
        result.validated()
    }

    pub fn validated(self) -> Option<Self> {
        if self.input_tokens.is_none() && self.output_tokens.is_none() {
            return None;
        }
        if let (Some(input), Some(output), Some(total)) =
            (self.input_tokens, self.output_tokens, self.total_tokens)
        {
            if input.checked_add(output) != Some(total) {
                return None;
            }
        }
        if self
            .cached_input_tokens
            .zip(self.input_tokens)
            .is_some_and(|(cache, input)| cache > input)
            || self
                .reasoning_output_tokens
                .zip(self.output_tokens)
                .is_some_and(|(reasoning, output)| reasoning > output)
        {
            return None;
        }
        Some(self)
    }
}
