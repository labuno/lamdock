use localagentmanager_core::{self as core, AppError, Result};
use std::path::Path;

#[derive(Default)]
pub struct StartupState {
    pub issue: Option<String>,
}

type MaintenanceStep = (&'static str, fn(&Path, u64) -> Result<()>);

pub fn initialize(home: &Path) -> StartupState {
    let now = chrono::Utc::now().timestamp_millis().max(0) as u64;
    let steps: &[MaintenanceStep] = &[
        ("legacy data", |home, _| {
            core::lam_paths::migrate_legacy_lam_data(home).map(|_| ())
        }),
        ("transaction recovery", |home, now| {
            core::recover_provider_transactions_service_v2(home, now).map(|_| ())
        }),
        ("provider configuration", |home, now| {
            core::migrate_native_responses_bindings_service_v2(home, now).map(|_| ())
        }),
        ("managed wrappers", |home, _| {
            core::repair_managed_wrappers(home).map(|_| ())
        }),
        ("Codex command", |home, _| {
            core::repair_codex_command(home).map(|_| ())
        }),
        ("auth projections", |home, _| {
            core::repair_stale_codex_auth_projections_service_v2(home).map(|_| ())
        }),
    ];
    for (stage, step) in steps {
        if let Err(error) = step(home, now) {
            return report_issue(stage, error);
        }
    }
    StartupState::default()
}

fn report_issue(stage: &str, error: AppError) -> StartupState {
    eprintln!("Startup maintenance ({stage}): {}", error.code);
    StartupState {
        issue: Some(format!("Startup maintenance needs attention ({stage}): {}. Review your provider configuration and restart LamDock.", error.code)),
    }
}
