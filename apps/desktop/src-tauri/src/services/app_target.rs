use super::error::Result;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use toml_edit::DocumentMut;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AppTargetKind {
    Account,
    Provider,
    CustomProvider,
}

/// What the Codex App (the default `~/.codex` space) currently runs on.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppTarget {
    pub kind: AppTargetKind,
    pub account_id: Option<String>,
    pub provider_id: Option<String>,
}

/// A LAM binding on `main` wins over the hand-written `model_provider`,
/// which wins over the account the credential slot points to.
pub fn get_app_target(home_root: &Path) -> Result<AppTarget> {
    if let Some(provider_id) = main_binding_provider(home_root)? {
        return Ok(AppTarget {
            kind: AppTargetKind::Provider,
            account_id: None,
            provider_id: Some(provider_id),
        });
    }
    if let Some(provider_id) = custom_model_provider(home_root) {
        return Ok(AppTarget {
            kind: AppTargetKind::CustomProvider,
            account_id: None,
            provider_id: Some(provider_id),
        });
    }
    let account_id = super::account::list_accounts(home_root)?
        .into_iter()
        .find(|account| account.id != "main" && account.is_active_auth)
        .map(|account| account.id);
    Ok(AppTarget {
        kind: AppTargetKind::Account,
        account_id,
        provider_id: None,
    })
}

fn main_binding_provider(home_root: &Path) -> Result<Option<String>> {
    let paths = super::provider_runtime::ProviderHubPaths::for_home(home_root);
    if !paths.canonical_root().exists() && !paths.legacy_root().exists() {
        return Ok(None);
    }
    Ok(
        super::provider_api_v2::list_binding_views_service_v2(home_root)?
            .into_iter()
            .find(|binding| binding.profile_id == "main")
            .map(|binding| binding.provider_id),
    )
}

fn custom_model_provider(home_root: &Path) -> Option<String> {
    let source = fs::read_to_string(home_root.join(".codex/config.toml")).ok()?;
    let document = source.parse::<DocumentMut>().ok()?;
    let provider = document.get("model_provider")?.as_str()?.trim();
    (!provider.is_empty() && provider != "openai").then(|| provider.to_string())
}
