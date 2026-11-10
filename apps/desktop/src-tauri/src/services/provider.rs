use super::error::{AppError, Result};
use super::types::config_root;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProviderProfile {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub wire_api: String,
    pub default_model: String,
    pub env_key: Option<String>,
    pub secret_storage: String,
    pub health: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CreateProviderRequest {
    pub id: String,
    pub name: String,
    pub base_url: String,
    pub wire_api: String,
    pub default_model: String,
    pub env_key: Option<String>,
    pub secret: Option<SecretInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SecretInput {
    Env { env_key: String },
    Keychain { secret: String },
    None,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttachProviderRequest {
    pub profile_id: String,
    pub provider_id: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AttachProviderResult {
    pub profile_id: String,
    pub provider_id: String,
    pub config_path: PathBuf,
    pub backup_path: PathBuf,
    pub operations: Vec<String>,
    pub warnings: Vec<String>,
}

/// Read the historical store for legacy contract and migration verification.
pub fn list_providers(home_root: &Path) -> Result<Vec<ProviderProfile>> {
    let path = config_root(home_root).join("providers.json");
    if !path.exists() {
        return Ok(Vec::new());
    }
    let body = fs::read_to_string(path)?;
    serde_json::from_str(&body)
        .map_err(|err| AppError::new("PROVIDER_STORE_INVALID", err.to_string()))
}
