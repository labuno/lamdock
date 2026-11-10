use super::account::{has_codex_signal, replace_wrapper};
use super::error::{AppError, Result};
use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
};

const COMMAND_SCRIPT: &str = include_str!("../../resources/codex-command.sh");
const COMMAND_MARKER: &str = "#!/usr/bin/env bash\n# LAM managed Codex proxy entry\n";

pub fn repair_codex_command(home: &Path) -> Result<Option<PathBuf>> {
    if !has_codex_signal(&home.join(".codex")) {
        return Ok(None);
    }
    let path = home.join(".local/bin/codex");
    if !command_needs_repair(&path)? {
        return Ok(None);
    }
    replace_wrapper(&path, COMMAND_SCRIPT)?;
    Ok(Some(path))
}

fn command_needs_repair(path: &Path) -> Result<bool> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == ErrorKind::NotFound => return Ok(true),
        Err(error) => return Err(error.into()),
    };
    let conflict = || {
        AppError::new(
            "CODEX_COMMAND_CONFLICT",
            format!(
                "{} already belongs to another installation; LAM did not replace it",
                path.display(),
            ),
        )
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err(conflict());
    }
    let source = fs::read_to_string(path)?;
    if !source.starts_with(COMMAND_MARKER) {
        return Err(conflict());
    }
    Ok(source != COMMAND_SCRIPT)
}
