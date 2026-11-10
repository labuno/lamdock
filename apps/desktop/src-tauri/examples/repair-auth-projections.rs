//! Explicit manual repair: cargo run --example repair-auth-projections -- /path/to/home
use std::path::PathBuf;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let home = std::env::args_os()
        .nth(1)
        .map(PathBuf::from)
        .ok_or("usage: repair-auth-projections /path/to/home")?;
    let repaired = localagentmanager_core::repair_stale_codex_auth_projections_service_v2(&home)
        .map_err(|err| format!("{}: {}", err.code, err.message))?;
    println!("repaired profiles: {repaired:?}");
    Ok(())
}
