use super::account::{find_account, list_accounts, CodexAccount};
use super::error::{AppError, Result};
use super::gateway::launch_planner::resolve_profile_route;
use super::provider_binding::RouteKind;
use super::types::{config_root, validate_profile_id, write_file_private};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::{
    fs,
    path::{Path, PathBuf},
};

pub(crate) const PROXY_ENV_NAMES: [&str; 8] = [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "NO_PROXY",
    "no_proxy",
];
const LOCAL_BYPASS: &str = "localhost,127.0.0.1,::1";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AccountProxySettings {
    pub enabled: bool,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateAccountProxyRequest {
    pub profile_id: String,
    pub enabled: bool,
    pub url: String,
}

pub fn load_account_proxy(home: &Path, profile_id: &str) -> Result<Option<AccountProxySettings>> {
    read_account_proxy(home, &validate_profile_id(profile_id)?)
}

pub(crate) fn active_proxy_url(settings: Option<&AccountProxySettings>) -> Option<&str> {
    settings
        .filter(|settings| settings.enabled)
        .map(|settings| settings.url.as_str())
}

fn proxy_environment(url: &str) -> impl Iterator<Item = (&'static str, &str)> {
    PROXY_ENV_NAMES.into_iter().map(move |name| {
        (
            name,
            if name.eq_ignore_ascii_case("no_proxy") {
                LOCAL_BYPASS
            } else {
                url
            },
        )
    })
}

pub(crate) fn apply_proxy_environment(command: &mut Command, proxy_url: Option<&str>) {
    if let Some(url) = proxy_url {
        command.envs(proxy_environment(url));
    }
}

pub(crate) fn shell_proxy_environment(settings: Option<&AccountProxySettings>) -> String {
    let Some(url) = active_proxy_url(settings) else {
        return String::new();
    };
    proxy_environment(url)
        .map(|(name, value)| format!("{name}={} ", super::types::shell_quote(value)))
        .collect()
}

fn proxy_path(home: &Path, profile_id: &str) -> PathBuf {
    config_root(home)
        .join("account-proxies")
        .join(format!("{profile_id}.json"))
}

pub(crate) fn read_account_proxy(
    home: &Path,
    profile_id: &str,
) -> Result<Option<AccountProxySettings>> {
    let path = proxy_path(home, profile_id);
    let source = match fs::read_to_string(path) {
        Ok(source) => source,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(error.into()),
    };
    let settings: AccountProxySettings = serde_json::from_str(&source)
        .map_err(|error| AppError::new("ACCOUNT_PROXY_CONFIG_INVALID", error.to_string()))?;
    if settings.enabled {
        validate_proxy_url(&settings.url)?;
    }
    Ok(Some(settings))
}

fn validate_proxy_url(value: &str) -> Result<()> {
    let invalid = || {
        AppError::new(
            "ACCOUNT_PROXY_URL_INVALID",
            "Use an HTTP/HTTPS proxy address, for example http://127.0.0.1:17891",
        )
    };
    if value.chars().any(char::is_control) {
        return Err(invalid());
    }
    let parsed = url::Url::parse(value).map_err(|_| invalid())?;
    if !matches!(parsed.scheme(), "http" | "https")
        || parsed.host_str().is_none()
        || parsed.port_or_known_default().is_none()
        || parsed.path() != "/"
        || parsed.query().is_some()
        || parsed.fragment().is_some()
    {
        return Err(invalid());
    }
    Ok(())
}

pub fn update_account_proxy(
    home: &Path,
    request: &UpdateAccountProxyRequest,
) -> Result<CodexAccount> {
    let profile_id = validate_profile_id(&request.profile_id)?;
    let account = find_account(home, &profile_id)?;
    if request.enabled && resolve_profile_route(home, &profile_id)? == RouteKind::Gateway {
        return Err(AppError::new(
            "ACCOUNT_PROXY_ROUTE_UNSUPPORTED",
            "Independent proxy is currently supported for Direct Codex accounts only",
        ));
    }
    let settings = updated_proxy_settings(account.proxy, request)?;
    if profile_id == "main" && request.enabled {
        super::codex_command::repair_codex_command(home)?;
    }
    write_proxy(home, &profile_id, &settings)?;
    let accounts = list_accounts(home)?;
    accounts
        .into_iter()
        .find(|account| account.id == profile_id)
        .ok_or_else(|| AppError::new("ACCOUNT_NOT_FOUND", profile_id))
}

fn updated_proxy_settings(
    previous: Option<AccountProxySettings>,
    request: &UpdateAccountProxyRequest,
) -> Result<AccountProxySettings> {
    let url = if request.enabled {
        let value = request.url.trim();
        validate_proxy_url(value)?;
        value.to_owned()
    } else {
        previous.map(|proxy| proxy.url).unwrap_or_default()
    };
    Ok(AccountProxySettings {
        enabled: request.enabled,
        url,
    })
}

fn write_proxy(home: &Path, profile_id: &str, settings: &AccountProxySettings) -> Result<()> {
    let path = proxy_path(home, profile_id);
    let temporary = path.with_extension(format!("{}.tmp", uuid::Uuid::new_v4()));
    let body = serde_json::to_string_pretty(settings)
        .map_err(|error| AppError::new("ACCOUNT_PROXY_CONFIG_INVALID", error.to_string()))?;
    write_file_private(&temporary, &format!("{body}\n"))?;
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(temporary);
        return Err(error.into());
    }
    Ok(())
}

pub(crate) fn rename_account_proxy(home: &Path, from: &str, to: &str) -> Result<()> {
    let source = proxy_path(home, from);
    if source.exists() {
        fs::rename(source, proxy_path(home, to))?;
    }
    Ok(())
}

pub(crate) fn remove_account_proxy(home: &Path, profile_id: &str) -> Result<()> {
    let path = proxy_path(home, profile_id);
    if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}
