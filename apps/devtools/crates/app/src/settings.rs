//! The app's settings: one global value, saved to `settings.json` beside `devices.json` on every
//! change. Views observe the global to react, so a setting has no listeners of its own.

use std::path::PathBuf;

use gpui::{App, BorrowAppContext, Global};
use serde::{Deserialize, Serialize};
use unbound_devtools_core::presets::PresetFile;
use unbound_devtools_core::{DEFAULT_BRIDGE_PORT, DEFAULT_DEVTOOLS_PORT, DEFAULT_MCP_PORT};

const FILE_NAME: &str = "settings.json";

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Appearance {
	#[default]
	System,
	Dark,
	Light,
}

impl Appearance {
	pub const ALL: [Appearance; 3] = [Appearance::System, Appearance::Dark, Appearance::Light];

	pub fn label(self) -> &'static str {
		match self {
			Appearance::System => "Match the System",
			Appearance::Dark => "Dark",
			Appearance::Light => "Light",
		}
	}

	pub fn key(self) -> &'static str {
		match self {
			Appearance::System => "system",
			Appearance::Dark => "dark",
			Appearance::Light => "light",
		}
	}
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct Settings {
	pub appearance: Appearance,
	/// How to run the CLI, such as `ubd` or `bunx @unbound-app/cli`.
	pub cli_command: String,
	/// Where commands run; the addon workspace for `build`, `check` and `dev`. Empty is the home folder.
	pub project_dir: String,
	pub bridge_port: u16,
	/// The host a device dials back to; empty reads it from the device's debugger settings.
	pub advertise_host: String,
	pub devtools_port: u16,
	pub mcp_enabled: bool,
	pub mcp_port: u16,
}

impl Default for Settings {
	fn default() -> Self {
		Self {
			appearance: Appearance::System,
			cli_command: "ubd".into(),
			project_dir: String::new(),
			bridge_port: DEFAULT_BRIDGE_PORT,
			advertise_host: String::new(),
			devtools_port: DEFAULT_DEVTOOLS_PORT,
			mcp_enabled: true,
			mcp_port: DEFAULT_MCP_PORT,
		}
	}
}

impl Settings {
	/// The folder commands run in: the project folder, else the home folder.
	pub fn working_dir(&self) -> Option<PathBuf> {
		let dir = self.project_dir.trim();
		if dir.is_empty() {
			return dirs_home();
		}
		let path = match dir.strip_prefix("~/") {
			Some(rest) => dirs_home()?.join(rest),
			None => PathBuf::from(dir),
		};
		Some(path)
	}
}

fn dirs_home() -> Option<PathBuf> {
	std::env::var_os(if cfg!(windows) { "USERPROFILE" } else { "HOME" }).map(PathBuf::from)
}

/// The global the settings live in; observe it to react to a change.
pub struct Store {
	settings: Settings,
	path: Option<PathBuf>,
}

impl Global for Store {}

fn locate() -> Option<PathBuf> {
	let devices = PresetFile::locate().ok()?;
	Some(devices.path().parent()?.join(FILE_NAME))
}

/// Reads `settings.json`; a missing or unreadable file is the defaults, logged.
pub fn load() -> Settings {
	let Some(path) = locate() else {
		return Settings::default();
	};
	match std::fs::read(&path) {
		Ok(bytes) => serde_json::from_slice(&bytes).unwrap_or_else(|error| {
			tracing::warn!("Failed to read the settings in {}: {error}", path.display());
			Settings::default()
		}),
		Err(error) if error.kind() == std::io::ErrorKind::NotFound => Settings::default(),
		Err(error) => {
			tracing::warn!("Failed to read the settings in {}: {error}", path.display());
			Settings::default()
		}
	}
}

pub fn init(settings: Settings, cx: &mut App) {
	cx.set_global(Store {
		settings,
		path: locate(),
	});
}

pub fn get(cx: &App) -> &Settings {
	&cx.global::<Store>().settings
}

/// Changes the settings and saves them; observers of the global see the change.
pub fn update(cx: &mut App, change: impl FnOnce(&mut Settings)) {
	cx.update_global::<Store, _>(|store, _| {
		let before = store.settings.clone();
		change(&mut store.settings);
		if store.settings == before {
			return;
		}
		if let Some(path) = &store.path
			&& let Err(error) = save(path, &store.settings)
		{
			tracing::error!("Failed to save the settings to {}: {error}", path.display());
		}
	});
}

fn save(path: &PathBuf, settings: &Settings) -> std::io::Result<()> {
	if let Some(dir) = path.parent() {
		std::fs::create_dir_all(dir)?;
	}
	let mut json = serde_json::to_vec_pretty(settings).map_err(std::io::Error::other)?;
	json.push(b'\n');
	let temp = path.with_extension(format!("{}.tmp", std::process::id()));
	std::fs::write(&temp, json)?;
	std::fs::rename(&temp, path)
}

#[cfg(test)]
mod tests {
	use super::{Appearance, Settings};

	#[test]
	fn missing_keys_take_their_defaults() {
		let settings: Settings = serde_json::from_str(r#"{"cliCommand":"bunx ubd"}"#).unwrap();
		assert_eq!(settings.cli_command, "bunx ubd");
		assert_eq!(settings.bridge_port, Settings::default().bridge_port);
		assert_eq!(settings.appearance, Appearance::System);
	}
}
