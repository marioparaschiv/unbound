//! Saved devices: named Unbound debugger bridges the GUI's "Connect device" menu and the MCP
//! `connect_device` tool both dial. Persisted as JSON in the platform config dir
//! (`unbound-devtools/devices.json`, or `$UNBOUND_DEVTOOLS_CONFIG_DIR/devices.json`).

use std::fmt;
use std::io::Write;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::str::FromStr;

use serde::{Deserialize, Serialize};

/// Overrides the directory `devices.json` lives in.
pub const CONFIG_DIR_ENV: &str = "UNBOUND_DEVTOOLS_CONFIG_DIR";
const FILE_NAME: &str = "devices.json";

#[derive(Debug, thiserror::Error)]
pub enum PresetError {
	#[error("give the device a name")]
	EmptyName,
	#[error("{0:?} is not a bridge address; use host:port, like 100.64.0.2:9090")]
	InvalidBridge(String),
	#[error("{0:?} is not a host name; use a host or IP without a port, like 100.64.0.5")]
	InvalidHost(String),
	#[error("a device named {0:?} already exists")]
	Duplicate(String),
	#[error("no device named {0:?}")]
	NotFound(String),
	#[error("the saved devices in {path} are unreadable ({reason}); fix or delete the file")]
	Corrupt { path: PathBuf, reason: String },
	#[error("cannot find a config directory; set {CONFIG_DIR_ENV}")]
	NoConfigDir,
	#[error("{path}: {source}")]
	Io {
		path: PathBuf,
		source: std::io::Error,
	},
}

/// `host:port` of an Unbound debugger bridge. The host may be a name (`vps.tailnet.ts.net`), so
/// it is resolved when dialed, not when saved.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(try_from = "String", into = "String")]
pub struct BridgeAddr {
	host: String,
	port: u16,
}

impl BridgeAddr {
	pub fn host(&self) -> &str {
		&self.host
	}

	pub fn port(&self) -> u16 {
		self.port
	}
}

impl From<SocketAddr> for BridgeAddr {
	fn from(addr: SocketAddr) -> Self {
		Self {
			host: addr.ip().to_string(),
			port: addr.port(),
		}
	}
}

impl FromStr for BridgeAddr {
	type Err = PresetError;

	fn from_str(text: &str) -> Result<Self, Self::Err> {
		let text = text.trim();
		let invalid = || PresetError::InvalidBridge(text.to_owned());

		if let Ok(addr) = text.parse::<SocketAddr>() {
			return Ok(addr.into());
		}

		let (host, port) = text.rsplit_once(':').ok_or_else(invalid)?;
		let port = port
			.parse::<u16>()
			.ok()
			.filter(|port| *port != 0)
			.ok_or_else(invalid)?;

		if !is_host_name(host) {
			return Err(invalid());
		}

		Ok(Self {
			host: host.to_owned(),
			port,
		})
	}
}

impl TryFrom<String> for BridgeAddr {
	type Error = PresetError;

	fn try_from(text: String) -> Result<Self, Self::Error> {
		text.parse()
	}
}

impl From<BridgeAddr> for String {
	fn from(addr: BridgeAddr) -> Self {
		addr.to_string()
	}
}

impl fmt::Display for BridgeAddr {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		if self.host.contains(':') {
			write!(f, "[{}]:{}", self.host, self.port)
		} else {
			write!(f, "{}:{}", self.host, self.port)
		}
	}
}

fn is_host_name(host: &str) -> bool {
	!host.is_empty()
		&& host
			.chars()
			.all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '.' | '-' | '_'))
}

/// Where to ask a device to connect from: the bridge it is attached to, and the host it should
/// dial back. `advertise_host: None` reads the host from the device's `debugger.address`.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConnectTarget {
	pub bridge: BridgeAddr,
	pub advertise_host: Option<String>,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct DevicePreset {
	pub name: String,
	pub bridge: BridgeAddr,
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub advertise_host: Option<String>,
}

impl DevicePreset {
	/// Parses user input; blank `advertise_host` means "ask the device".
	pub fn parse(name: &str, bridge: &str, advertise_host: &str) -> Result<Self, PresetError> {
		let name = name.trim();

		if name.is_empty() {
			return Err(PresetError::EmptyName);
		}

		let advertise_host = parse_host(advertise_host)?;

		Ok(Self {
			name: name.to_owned(),
			bridge: bridge.parse()?,
			advertise_host,
		})
	}

	pub fn target(&self) -> ConnectTarget {
		ConnectTarget {
			bridge: self.bridge.clone(),
			advertise_host: self.advertise_host.clone(),
		}
	}
}

/// A dial-back host: a name or an IP literal, never a port or a URL. Blank is `None`.
pub fn parse_host(text: &str) -> Result<Option<String>, PresetError> {
	let text = text.trim();

	if text.is_empty() {
		return Ok(None);
	}

	if text.parse::<std::net::IpAddr>().is_ok() || is_host_name(text) {
		return Ok(Some(text.to_owned()));
	}

	Err(PresetError::InvalidHost(text.to_owned()))
}

/// The saved devices, in the order they were added, and the one the main button dials.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Presets {
	#[serde(default)]
	pub devices: Vec<DevicePreset>,
	/// A preset name; `None` is the CLI's bridge.
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub last_used: Option<String>,
}

impl Presets {
	/// Case-insensitive, like the uniqueness rule.
	pub fn get(&self, name: &str) -> Option<&DevicePreset> {
		self.devices
			.iter()
			.find(|preset| preset.name.eq_ignore_ascii_case(name.trim()))
	}

	/// The preset the main button dials, if `last_used` still names one.
	pub fn last_used(&self) -> Option<&DevicePreset> {
		self.get(self.last_used.as_deref()?)
	}

	pub fn insert(&mut self, preset: DevicePreset) -> Result<(), PresetError> {
		if self.get(&preset.name).is_some() {
			return Err(PresetError::Duplicate(preset.name));
		}

		self.devices.push(preset);
		Ok(())
	}

	pub fn remove(&mut self, name: &str) -> Result<DevicePreset, PresetError> {
		let ix = self
			.devices
			.iter()
			.position(|preset| preset.name.eq_ignore_ascii_case(name.trim()))
			.ok_or_else(|| PresetError::NotFound(name.to_owned()))?;
		let removed = self.devices.remove(ix);

		if self
			.last_used
			.as_deref()
			.is_some_and(|last| last.eq_ignore_ascii_case(&removed.name))
		{
			self.last_used = None;
		}

		Ok(removed)
	}

	fn validate(&self) -> Result<(), String> {
		for (ix, preset) in self.devices.iter().enumerate() {
			if preset.name.trim().is_empty() {
				return Err("a device has no name".to_owned());
			}

			if self.devices[..ix]
				.iter()
				.any(|other| other.name.eq_ignore_ascii_case(&preset.name))
			{
				return Err(format!("two devices are named {:?}", preset.name));
			}
		}

		Ok(())
	}
}

/// `devices.json` on disk.
#[derive(Clone, Debug)]
pub struct PresetFile {
	path: PathBuf,
}

impl PresetFile {
	pub fn new(path: impl Into<PathBuf>) -> Self {
		Self { path: path.into() }
	}

	/// `$UNBOUND_DEVTOOLS_CONFIG_DIR/devices.json`, else `<config dir>/unbound-devtools/devices.json`.
	pub fn locate() -> Result<Self, PresetError> {
		if let Some(dir) = std::env::var_os(CONFIG_DIR_ENV).filter(|dir| !dir.is_empty()) {
			return Ok(Self::new(PathBuf::from(dir).join(FILE_NAME)));
		}

		let dir = dirs::config_dir().ok_or(PresetError::NoConfigDir)?;
		Ok(Self::new(dir.join("unbound-devtools").join(FILE_NAME)))
	}

	pub fn path(&self) -> &Path {
		&self.path
	}

	/// A missing file is no presets; an unreadable one is an error, so nothing overwrites it.
	pub fn load(&self) -> Result<Presets, PresetError> {
		let bytes = match std::fs::read(&self.path) {
			Ok(bytes) => bytes,
			Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
				return Ok(Presets::default());
			}
			Err(source) => return Err(self.io(source)),
		};
		let corrupt = |reason: String| PresetError::Corrupt {
			path: self.path.clone(),
			reason,
		};
		let presets: Presets =
			serde_json::from_slice(&bytes).map_err(|error| corrupt(error.to_string()))?;

		presets.validate().map_err(corrupt)?;
		Ok(presets)
	}

	/// Writes a sibling temp file and renames it over the target, so a crash leaves either the
	/// old file or the new one.
	pub fn save(&self, presets: &Presets) -> Result<(), PresetError> {
		let dir = self.path.parent().unwrap_or(Path::new("."));
		std::fs::create_dir_all(dir).map_err(|source| self.io(source))?;

		let temp = dir.join(format!(".{FILE_NAME}.{}.tmp", std::process::id()));
		let json = serde_json::to_vec_pretty(presets).expect("presets serialize");
		let written = std::fs::File::create(&temp).and_then(|mut file| {
			file.write_all(&json)?;
			file.write_all(b"\n")?;
			file.sync_all()
		});
		let renamed = written.and_then(|()| std::fs::rename(&temp, &self.path));

		if let Err(source) = renamed {
			let _ = std::fs::remove_file(&temp);
			return Err(self.io(source));
		}

		Ok(())
	}

	/// Loads, applies `change`, and saves only when it changed something.
	pub fn update<T>(
		&self,
		change: impl FnOnce(&mut Presets) -> Result<T, PresetError>,
	) -> Result<T, PresetError> {
		let mut presets = self.load()?;
		let before = presets.clone();
		let out = change(&mut presets)?;

		if presets != before {
			self.save(&presets)?;
		}

		Ok(out)
	}

	fn io(&self, source: std::io::Error) -> PresetError {
		PresetError::Io {
			path: self.path.clone(),
			source,
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn temp_dir(name: &str) -> PathBuf {
		let dir = std::env::temp_dir().join(format!(
			"unbound-devtools-presets-{name}-{}",
			std::process::id()
		));
		let _ = std::fs::remove_dir_all(&dir);
		dir
	}

	fn vm() -> DevicePreset {
		DevicePreset::parse("iPhone VM", "100.64.0.2:9090", "").expect("valid")
	}

	#[test]
	fn round_trips_through_the_file() {
		let file = PresetFile::new(temp_dir("round-trip").join("nested").join(FILE_NAME));
		assert_eq!(file.load().expect("missing is empty"), Presets::default());

		let mut presets = Presets::default();
		presets.insert(vm()).expect("inserted");
		presets
			.insert(
				DevicePreset::parse("Pixel", "pixel.tailnet.ts.net:9091", " 100.64.0.9 ")
					.expect("valid"),
			)
			.expect("inserted");
		presets.last_used = Some("Pixel".to_owned());
		file.save(&presets).expect("saved");

		let loaded = file.load().expect("loaded");
		assert_eq!(loaded, presets);
		assert_eq!(
			loaded.last_used().map(|preset| preset.bridge.port()),
			Some(9091)
		);
		assert_eq!(
			loaded
				.get("pixel")
				.and_then(|preset| preset.advertise_host.as_deref()),
			Some("100.64.0.9")
		);
	}

	#[test]
	fn rejects_a_duplicate_name_in_any_case() {
		let mut presets = Presets::default();
		presets.insert(vm()).expect("inserted");

		let mut twin = vm();
		twin.name = "iphone vm".to_owned();
		assert!(matches!(
			presets.insert(twin),
			Err(PresetError::Duplicate(_))
		));
		assert_eq!(presets.devices.len(), 1);
	}

	#[test]
	fn rejects_bad_input() {
		for bridge in [
			"",
			"9090",
			"host",
			"host:0",
			"host:99999",
			"ws://host:9090",
			"a b:1",
		] {
			let error = DevicePreset::parse("x", bridge, "").expect_err(bridge);
			assert!(
				matches!(error, PresetError::InvalidBridge(_)),
				"{bridge}: {error}"
			);
			assert!(error.to_string().contains("host:port"), "{error}");
		}

		assert!(matches!(
			DevicePreset::parse(" ", "h:1", ""),
			Err(PresetError::EmptyName)
		));
		assert!(matches!(
			DevicePreset::parse("x", "h:1", "h:8097"),
			Err(PresetError::InvalidHost(_))
		));

		let v6 = DevicePreset::parse("x", "[fd7a::1]:9090", "fd7a::2").expect("IPv6");
		assert_eq!(v6.bridge.to_string(), "[fd7a::1]:9090");
		assert_eq!(v6.advertise_host.as_deref(), Some("fd7a::2"));
	}

	#[test]
	fn reports_a_corrupt_file_and_leaves_it_alone() {
		let dir = temp_dir("corrupt");
		std::fs::create_dir_all(&dir).expect("dir");
		let file = PresetFile::new(dir.join(FILE_NAME));

		for body in [
			"{ not json",
			r#"{"devices":[{"name":"a","bridge":"nope"}]}"#,
			r#"{"devices":[{"name":"a","bridge":"h:1"},{"name":"A","bridge":"h:2"}]}"#,
		] {
			std::fs::write(file.path(), body).expect("written");

			assert!(
				matches!(file.load(), Err(PresetError::Corrupt { .. })),
				"{body}"
			);
			assert!(file.update(|presets| presets.insert(vm())).is_err());
			assert_eq!(std::fs::read_to_string(file.path()).expect("kept"), body);
		}
	}

	#[test]
	fn a_save_leaves_no_temp_file_and_replaces_whole() {
		let dir = temp_dir("atomic");
		let file = PresetFile::new(dir.join(FILE_NAME));

		file.update(|presets| presets.insert(vm())).expect("saved");
		file.update(|presets| presets.remove("iphone vm").map(drop))
			.expect("removed");

		let names: Vec<_> = std::fs::read_dir(&dir)
			.expect("dir")
			.map(|entry| entry.expect("entry").file_name())
			.collect();
		assert_eq!(names, [FILE_NAME]);
		assert_eq!(file.load().expect("loaded"), Presets::default());
	}

	#[test]
	fn a_failed_save_keeps_the_old_file() {
		let dir = temp_dir("failed-save");
		let file = PresetFile::new(dir.join(FILE_NAME));
		file.update(|presets| presets.insert(vm())).expect("saved");
		let before = std::fs::read(file.path()).expect("read");

		let temp = dir.join(format!(".{FILE_NAME}.{}.tmp", std::process::id()));
		std::fs::create_dir_all(&temp).expect("blocker");
		let mut presets = file.load().expect("loaded");
		presets.last_used = Some("iPhone VM".to_owned());

		assert!(matches!(file.save(&presets), Err(PresetError::Io { .. })));
		assert_eq!(std::fs::read(file.path()).expect("read"), before);
	}

	#[test]
	fn removing_the_last_used_preset_falls_back_to_the_default() {
		let mut presets = Presets::default();
		presets.insert(vm()).expect("inserted");
		presets.last_used = Some("iPhone VM".to_owned());

		presets.remove("IPHONE VM").expect("removed");
		assert_eq!(presets.last_used, None);
		assert!(matches!(
			presets.remove("iPhone VM"),
			Err(PresetError::NotFound(_))
		));
	}
}
