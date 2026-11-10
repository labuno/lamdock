use crate::{antigravity_port, AppError};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;
use std::sync::{Mutex, OnceLock, TryLockError};

static ANTIGRAVITY_REFRESH_LOCK: OnceLock<Mutex<()>> = OnceLock::new();
static ANTIGRAVITY_PORT_CACHE: OnceLock<Mutex<Option<AntigravityPortCache>>> = OnceLock::new();

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityModelQuota {
    pub label: String,
    pub remaining_fraction: Option<f64>,
    pub reset_time: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityQuotaBucket {
    pub bucket_id: Option<String>,
    pub display_name: String,
    pub description: Option<String>,
    pub window: Option<String>,
    pub remaining_fraction: Option<f64>,
    pub reset_time: Option<String>,
    pub disabled: Option<bool>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityQuotaGroup {
    pub display_name: String,
    pub description: Option<String>,
    pub buckets: Vec<AntigravityQuotaBucket>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AntigravityQuotaResponse {
    pub ok: bool,
    pub models: Vec<AntigravityModelQuota>,
    pub description: Option<String>,
    pub groups: Vec<AntigravityQuotaGroup>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
struct AntigravityQuotaSummary {
    description: Option<String>,
    groups: Vec<AntigravityQuotaGroup>,
}

/// A discovered Antigravity language server process.
#[derive(Debug)]
struct AntigravityProcess {
    pid: u32,
    csrf_token: String,
    /// true = standalone Antigravity app, false = IDE extension
    is_standalone: bool,
}

#[derive(Debug, Clone)]
struct AntigravityPortCache {
    pid: u32,
    csrf_token: String,
    port: u16,
    response: AntigravityQuotaResponse,
}

fn refresh_lock() -> &'static Mutex<()> {
    ANTIGRAVITY_REFRESH_LOCK.get_or_init(|| Mutex::new(()))
}

fn port_cache() -> &'static Mutex<Option<AntigravityPortCache>> {
    ANTIGRAVITY_PORT_CACHE.get_or_init(|| Mutex::new(None))
}

fn read_port_cache() -> Option<AntigravityPortCache> {
    port_cache().lock().ok().and_then(|cache| cache.clone())
}

fn store_port_cache(proc: &AntigravityProcess, port: u16, response: &AntigravityQuotaResponse) {
    if let Ok(mut cache) = port_cache().lock() {
        *cache = Some(AntigravityPortCache {
            pid: proc.pid,
            csrf_token: proc.csrf_token.clone(),
            port,
            response: response.clone(),
        });
    }
}

fn clear_port_cache() {
    if let Ok(mut cache) = port_cache().lock() {
        *cache = None;
    }
}

fn cache_matches(
    processes: &[AntigravityProcess],
    configured_port: Option<u16>,
    cache: &AntigravityPortCache,
) -> bool {
    configured_port.is_none_or(|port| cache.port == port)
        && processes
            .iter()
            .any(|proc| proc.pid == cache.pid && proc.csrf_token == cache.csrf_token)
}

fn extract_arg_value(cmd: &str, arg: &str) -> Option<String> {
    let parts: Vec<&str> = cmd.split_whitespace().collect();
    for i in 0..parts.len() {
        if parts[i] == arg && i + 1 < parts.len() {
            return Some(parts[i + 1].to_string());
        }
        if parts[i].starts_with(arg) && parts[i].contains('=') {
            let subparts: Vec<&str> = parts[i].split('=').collect();
            if subparts.len() > 1 {
                return Some(subparts[1].to_string());
            }
        }
    }
    None
}

fn find_antigravity_processes() -> Result<Vec<AntigravityProcess>, AppError> {
    let output = Command::new("ps")
        .args(["-ww", "-eo", "pid,args"])
        .output()
        .map_err(|err| {
            AppError::new("PROCESS_SCAN_FAILED", format!("Failed to run ps: {}", err))
        })?;

    if !output.status.success() {
        return Err(AppError::new("PROCESS_SCAN_FAILED", "ps command failed"));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut processes = Vec::new();
    for line in stdout.lines() {
        let parts: Vec<&str> = line.trim().splitn(2, char::is_whitespace).collect();
        if parts.len() < 2 {
            continue;
        }

        let pid: u32 = match parts[0].trim().parse() {
            Ok(p) => p,
            Err(_) => continue,
        };

        let cmd = parts[1].trim();

        // Must contain a csrf_token argument to be a usable language server
        let token = match extract_arg_value(cmd, "--csrf_token") {
            Some(t) => t,
            None => continue,
        };

        // Check if this is an Antigravity-related language server process
        let lower_cmd = cmd.to_lowercase();
        let is_language_server =
            lower_cmd.contains("language_server") || lower_cmd.contains("language_server_macos");

        if !is_language_server {
            continue;
        }

        // Determine if it's the standalone app or IDE extension
        let is_standalone = cmd.contains("--standalone")
            || lower_cmd.contains("/antigravity.app/")
            || (cmd.contains("--app_data_dir")
                && cmd.contains("--app_data_dir antigravity ")
                && !cmd.contains("--app_data_dir antigravity-ide"));

        if !processes.iter().any(|p: &AntigravityProcess| p.pid == pid) {
            processes.push(AntigravityProcess {
                pid,
                csrf_token: token,
                is_standalone,
            });
        }
    }

    // Sort: standalone processes first (preferred), then IDE extensions
    processes.sort_by_key(|process| std::cmp::Reverse(process.is_standalone));

    if processes.is_empty() {
        return Err(AppError::new(
            "ANTIGRAVITY_PROCESS_NOT_FOUND",
            "Antigravity language server process not found",
        ));
    }

    Ok(processes)
}

/// POST a JSON payload to the Antigravity language server.
/// Tries HTTPS first (with -k for self-signed certs), then falls back to HTTP.
fn post_language_server_json(
    port: u16,
    csrf_token: &str,
    method: &str,
) -> Result<String, AppError> {
    let schemes = ["https", "http"];
    let mut last_err = None;

    for scheme in &schemes {
        let url = format!(
            "{}://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/{}",
            scheme, port, method
        );

        let mut cmd = Command::new("curl");
        if *scheme == "https" {
            cmd.arg("-k"); // allow self-signed certs
        }
        cmd.arg("-s")
            .arg("--noproxy")
            .arg("*")
            .arg("--connect-timeout")
            .arg("3")
            .arg("--max-time")
            .arg("8")
            .arg("-X")
            .arg("POST")
            .arg("-H")
            .arg("Content-Type: application/json")
            .arg("-H")
            .arg("Connect-Protocol-Version: 1")
            .arg("-H")
            .arg(format!("X-Codeium-Csrf-Token: {}", csrf_token))
            .arg("-d")
            .arg("{}")
            .arg(&url);

        let output = match cmd.output() {
            Ok(o) => o,
            Err(err) => {
                last_err = Some(AppError::new(
                    "CURL_FAILED",
                    format!("Failed to execute curl: {}", err),
                ));
                continue;
            }
        };

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            last_err = Some(AppError::new(
                "CURL_HTTP_ERROR",
                format!(
                    "curl {} exited with code {}. stderr: {}",
                    scheme,
                    output.status.code().unwrap_or(-1),
                    stderr.trim()
                ),
            ));
            continue;
        }

        return Ok(String::from_utf8_lossy(&output.stdout).into_owned());
    }

    Err(last_err.unwrap_or_else(|| {
        AppError::new(
            "UNKNOWN",
            format!("Failed to query {} via any scheme", method),
        )
    }))
}

fn parse_antigravity_model_quota_response(
    body: &str,
) -> Result<Vec<AntigravityModelQuota>, AppError> {
    let v: serde_json::Value = serde_json::from_str(body).map_err(|err| {
        AppError::new(
            "PARSE_JSON_FAILED",
            format!(
                "Failed to parse GetUserStatus JSON: {}. Body (first 200 chars): {}",
                err,
                &body[..body.len().min(200)]
            ),
        )
    })?;

    let configs = v
        .pointer("/userStatus/cascadeModelConfigData/clientModelConfigs")
        .or_else(|| v.pointer("/cascadeModelConfigData/clientModelConfigs"))
        .and_then(|v| v.as_array())
        .ok_or_else(|| {
            AppError::new(
                "NO_MODELS_FOUND",
                format!(
                    "No clientModelConfigs in GetUserStatus response. Top-level keys: {:?}",
                    v.as_object()
                        .map(|o| o.keys().collect::<Vec<_>>())
                        .unwrap_or_default()
                ),
            )
        })?;

    let models: Vec<_> = configs.iter().filter_map(parse_model_quota).collect();

    if models.is_empty() {
        return Err(AppError::new(
            "NO_MODELS_FOUND",
            "clientModelConfigs array was empty",
        ));
    }

    Ok(models)
}

fn parse_model_quota(config: &serde_json::Value) -> Option<AntigravityModelQuota> {
    let label = config.get("label")?.as_str()?.to_string();
    if label.is_empty() {
        return None;
    }

    Some(AntigravityModelQuota {
        label,
        remaining_fraction: config
            .pointer("/quotaInfo/remainingFraction")
            .and_then(|v| v.as_f64()),
        reset_time: config
            .pointer("/quotaInfo/resetTime")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

fn parse_quota_summary_response(body: &str) -> Result<AntigravityQuotaSummary, AppError> {
    let v: serde_json::Value = serde_json::from_str(body).map_err(|err| {
        AppError::new(
            "PARSE_JSON_FAILED",
            format!(
                "Failed to parse RetrieveUserQuotaSummary JSON: {}. Body (first 200 chars): {}",
                err,
                &body[..body.len().min(200)]
            ),
        )
    })?;

    let description = v
        .pointer("/response/description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let groups = v
        .pointer("/response/groups")
        .and_then(|v| v.as_array())
        .ok_or_else(|| AppError::new("NO_QUOTA_GROUPS_FOUND", "No quota groups found"))?;

    let groups: Vec<_> = groups.iter().filter_map(parse_quota_group).collect();
    if groups.is_empty() {
        return Err(AppError::new(
            "NO_QUOTA_GROUPS_FOUND",
            "Quota groups were empty",
        ));
    }

    Ok(AntigravityQuotaSummary {
        description,
        groups,
    })
}

fn parse_quota_group(group: &serde_json::Value) -> Option<AntigravityQuotaGroup> {
    let display_name = group.get("displayName")?.as_str()?.to_string();
    let buckets = group
        .get("buckets")
        .and_then(|v| v.as_array())?
        .iter()
        .filter_map(parse_quota_bucket)
        .collect::<Vec<_>>();

    if display_name.is_empty() || buckets.is_empty() {
        return None;
    }

    Some(AntigravityQuotaGroup {
        display_name,
        description: optional_string(group, "description"),
        buckets,
    })
}

fn parse_quota_bucket(bucket: &serde_json::Value) -> Option<AntigravityQuotaBucket> {
    let display_name = bucket.get("displayName")?.as_str()?.to_string();
    if display_name.is_empty() {
        return None;
    }

    Some(AntigravityQuotaBucket {
        bucket_id: optional_string(bucket, "bucketId"),
        display_name,
        description: optional_string(bucket, "description"),
        window: optional_string(bucket, "window"),
        remaining_fraction: bucket.get("remainingFraction").and_then(|v| v.as_f64()),
        reset_time: optional_string(bucket, "resetTime"),
        disabled: bucket.get("disabled").and_then(|v| v.as_bool()),
    })
}

fn optional_string(v: &serde_json::Value, key: &str) -> Option<String> {
    v.get(key).and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn query_antigravity_quota(
    port: u16,
    csrf_token: &str,
) -> Result<Vec<AntigravityModelQuota>, AppError> {
    let body = post_language_server_json(port, csrf_token, "GetUserStatus")?;
    parse_antigravity_model_quota_response(&body)
}

fn query_antigravity_quota_summary(
    port: u16,
    csrf_token: &str,
) -> Result<AntigravityQuotaSummary, AppError> {
    let body = post_language_server_json(port, csrf_token, "RetrieveUserQuotaSummary")?;
    parse_quota_summary_response(&body)
}

fn query_ports_for_quota(
    ports: &[u16],
    csrf_token: &str,
    last_err: &mut Option<AppError>,
) -> Option<(u16, AntigravityQuotaResponse)> {
    for port in ports {
        let summary = query_antigravity_quota_summary(*port, csrf_token);
        let models = query_antigravity_quota(*port, csrf_token);

        match (summary, models) {
            (Ok(summary), models_result) => {
                return Some((
                    *port,
                    AntigravityQuotaResponse {
                        ok: true,
                        models: models_result.unwrap_or_default(),
                        description: summary.description,
                        groups: summary.groups,
                        error: None,
                    },
                ));
            }
            (Err(_summary_err), Ok(models)) => {
                return Some((
                    *port,
                    AntigravityQuotaResponse {
                        ok: true,
                        models,
                        description: None,
                        groups: Vec::new(),
                        error: None,
                    },
                ));
            }
            (Err(summary_err), Err(model_err)) => {
                *last_err = Some(AppError::new(
                    "ANTIGRAVITY_QUOTA_QUERY_FAILED",
                    format!(
                        "summary failed: {}; models failed: {}",
                        summary_err.message, model_err.message
                    ),
                ));
            }
        }
    }
    None
}

fn parse_listening_ports(output: &str) -> Vec<u16> {
    let mut ports = Vec::new();
    for line in output.lines().filter_map(|line| line.strip_prefix('n')) {
        if let Some(port) = line
            .rsplit_once(':')
            .and_then(|(_, value)| value.parse::<u16>().ok())
        {
            if port != 0 && !ports.contains(&port) {
                ports.push(port);
            }
        }
    }
    ports
}

fn quota_candidate_ports(configured_port: Option<u16>, pid: u32) -> Result<Vec<u16>, AppError> {
    if let Some(port) = configured_port {
        return Ok(vec![port]);
    }
    let output = Command::new("/usr/sbin/lsof")
        .args([
            "-nP",
            "-a",
            "-p",
            &pid.to_string(),
            "-iTCP",
            "-sTCP:LISTEN",
            "-Fn",
        ])
        .output()
        .map_err(|error| AppError::new("ANTIGRAVITY_PORT_DISCOVERY_FAILED", error.to_string()))?;
    if !output.status.success() && !output.stderr.is_empty() {
        return Err(AppError::new(
            "ANTIGRAVITY_PORT_DISCOVERY_FAILED",
            "Could not inspect Antigravity listening ports",
        ));
    }
    Ok(parse_listening_ports(&String::from_utf8_lossy(
        &output.stdout,
    )))
}

fn acquire_refresh(lock: &Mutex<()>) -> Result<(std::sync::MutexGuard<'_, ()>, bool), AppError> {
    match lock.try_lock() {
        Ok(guard) => Ok((guard, false)),
        Err(TryLockError::WouldBlock) => lock.lock().map(|guard| (guard, true)).map_err(|_| {
            AppError::new(
                "ANTIGRAVITY_REFRESH_LOCK_FAILED",
                "Antigravity refresh lock poisoned",
            )
        }),
        Err(TryLockError::Poisoned(_)) => Err(AppError::new(
            "ANTIGRAVITY_REFRESH_LOCK_FAILED",
            "Antigravity refresh lock poisoned",
        )),
    }
}

pub fn get_live_antigravity_quota(home_root: &Path) -> Result<AntigravityQuotaResponse, AppError> {
    let (_refresh_guard, waited) = acquire_refresh(refresh_lock())?;
    let configured_port = antigravity_port(home_root);
    let processes = match find_antigravity_processes() {
        Ok(processes) => processes,
        Err(err) => {
            clear_port_cache();
            return Ok(AntigravityQuotaResponse {
                ok: false,
                models: Vec::new(),
                description: None,
                groups: Vec::new(),
                error: Some(format!("Failed to find process: {}", err.message)),
            });
        }
    };

    if waited {
        if let Some(cache) =
            read_port_cache().filter(|cache| cache_matches(&processes, configured_port, cache))
        {
            return Ok(cache.response);
        }
    }

    let mut last_err = None;
    for proc in processes {
        let ports = match quota_candidate_ports(configured_port, proc.pid) {
            Ok(ports) => ports,
            Err(error) => {
                last_err = Some(error);
                continue;
            }
        };
        if let Some((port, response)) =
            query_ports_for_quota(&ports, &proc.csrf_token, &mut last_err)
        {
            store_port_cache(&proc, port, &response);
            return Ok(response);
        }
    }

    clear_port_cache();
    Ok(AntigravityQuotaResponse {
        ok: false,
        models: Vec::new(),
        description: None,
        groups: Vec::new(),
        error: Some(format!(
            "Could not read Antigravity quota. Open Antigravity and refresh again. {}",
            last_err
                .map(|e| e.message)
                .unwrap_or_else(|| "No listening ports found.".to_string())
        )),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn concurrent_refresh_waits_for_the_running_query_to_finish() {
        let lock = std::sync::Arc::new(Mutex::new(()));
        let held = lock.lock().unwrap();
        let worker_lock = lock.clone();
        let (tx, rx) = std::sync::mpsc::channel();
        let worker = std::thread::spawn(move || {
            let (_guard, waited) = acquire_refresh(&worker_lock).unwrap();
            tx.send(waited).unwrap();
        });
        assert!(rx
            .recv_timeout(std::time::Duration::from_millis(50))
            .is_err());
        drop(held);
        assert!(rx.recv_timeout(std::time::Duration::from_secs(2)).unwrap());
        worker.join().unwrap();
    }

    #[test]
    fn parses_only_valid_listening_ports_and_deduplicates_addresses() {
        assert_eq!(parse_listening_ports("p42\nn127.0.0.1:5001\nn[::1]:5002\nn*:5001\nn127.0.0.1:0\nn127.0.0.1:70000\nninvalid\nn123\n"), vec![5001, 5002]);
        assert!(parse_listening_ports("").is_empty());
    }

    #[test]
    fn discovers_the_current_process_tcp_listener_without_a_configured_port() {
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        assert!(quota_candidate_ports(None, std::process::id())
            .unwrap()
            .contains(&port));
    }

    #[test]
    fn manual_port_override_does_not_scan_the_process() {
        assert_eq!(
            quota_candidate_ports(Some(57362), u32::MAX).unwrap(),
            vec![57362]
        );
    }

    #[test]
    fn automatic_mode_cache_tracks_process_identity_instead_of_a_manual_port() {
        let proc = AntigravityProcess {
            pid: 42,
            csrf_token: "token".into(),
            is_standalone: true,
        };
        let cache = AntigravityPortCache {
            pid: 42,
            csrf_token: "token".into(),
            port: 57362,
            response: sample_antigravity_response(),
        };
        assert!(cache_matches(&[proc], None, &cache));
        assert!(!cache_matches(&[], None, &cache));
    }

    #[test]
    fn antigravity_quota_summary_parses_weekly_and_five_hour_buckets() {
        let body = r#"{
          "response": {
            "description": "Within each group, models share a weekly limit and a 5-hour limit.",
            "groups": [
              {
                "displayName": "Gemini Models",
                "description": "Models within this group: Gemini Flash, Gemini Pro",
                "buckets": [
                  {
                    "bucketId": "gemini-weekly",
                    "displayName": "Weekly Limit",
                    "description": "Refreshes in 3 days",
                    "window": "weekly",
                    "remainingFraction": 0.91,
                    "resetTime": "2026-07-07T01:21:15Z"
                  },
                  {
                    "bucketId": "gemini-5h",
                    "displayName": "5h",
                    "window": "5h",
                    "remainingFraction": 0.82,
                    "resetTime": "2026-07-03T07:06:36Z"
                  }
                ]
              }
            ]
          }
        }"#;

        let summary = parse_quota_summary_response(body).unwrap();

        assert_eq!(
            summary.description.as_deref(),
            Some("Within each group, models share a weekly limit and a 5-hour limit.")
        );
        assert_eq!(summary.groups.len(), 1);
        assert_eq!(summary.groups[0].display_name, "Gemini Models");
        assert_eq!(summary.groups[0].buckets.len(), 2);
        assert_eq!(summary.groups[0].buckets[0].display_name, "Weekly Limit");
        assert_eq!(
            summary.groups[0].buckets[0].window.as_deref(),
            Some("weekly")
        );
        assert_eq!(summary.groups[0].buckets[1].display_name, "5h");
        assert_eq!(summary.groups[0].buckets[1].remaining_fraction, Some(0.82));
    }

    #[test]
    fn antigravity_quota_summary_reports_missing_groups() {
        let err = parse_quota_summary_response(r#"{"response":{}}"#).unwrap_err();

        assert_eq!(err.code, "NO_QUOTA_GROUPS_FOUND");
    }

    fn sample_antigravity_response() -> AntigravityQuotaResponse {
        AntigravityQuotaResponse {
            ok: true,
            models: vec![AntigravityModelQuota {
                label: "Gemini".to_string(),
                remaining_fraction: Some(0.5),
                reset_time: None,
            }],
            description: None,
            groups: Vec::new(),
            error: None,
        }
    }

    #[test]
    fn antigravity_cache_matches_pid_token_and_configured_port() {
        let proc = AntigravityProcess {
            pid: 42,
            csrf_token: "token-a".to_string(),
            is_standalone: true,
        };
        let cache = AntigravityPortCache {
            pid: 42,
            csrf_token: "token-a".to_string(),
            port: 57362,
            response: sample_antigravity_response(),
        };

        assert!(cache_matches(&[proc], Some(57362), &cache));
    }

    #[test]
    fn antigravity_cache_rejects_mismatched_pid_token_or_port() {
        let cache = AntigravityPortCache {
            pid: 42,
            csrf_token: "token-a".to_string(),
            port: 57362,
            response: sample_antigravity_response(),
        };
        let wrong_pid = AntigravityProcess {
            pid: 43,
            csrf_token: "token-a".to_string(),
            is_standalone: true,
        };
        let wrong_token = AntigravityProcess {
            pid: 42,
            csrf_token: "token-b".to_string(),
            is_standalone: true,
        };

        for matches in [
            cache_matches(&[wrong_pid], Some(57362), &cache),
            cache_matches(&[wrong_token], Some(57362), &cache),
            cache_matches(
                &[AntigravityProcess {
                    pid: 42,
                    csrf_token: "token-a".to_string(),
                    is_standalone: true,
                }],
                Some(57363),
                &cache,
            ),
        ] {
            assert!(!matches);
        }
    }
}
