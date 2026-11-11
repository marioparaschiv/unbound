use std::sync::OnceLock;

use unbound_devtools_core::presets::{CONFIG_DIR_ENV, PresetFile};
use unbound_devtools_core::{Config, DevicePreset, Devtools};

/// Every test here shares one config dir: the env var is process-wide.
fn config_dir() -> &'static std::path::Path {
	static DIR: OnceLock<std::path::PathBuf> = OnceLock::new();
	DIR.get_or_init(|| {
		let dir = std::env::temp_dir().join(format!("unbound-devtools-it-{}", std::process::id()));
		let _ = std::fs::remove_dir_all(&dir);
		// SAFETY: set once, before any test reads it, under the OnceLock.
		unsafe { std::env::set_var(CONFIG_DIR_ENV, &dir) };
		dir
	})
}

fn session() -> Devtools {
	config_dir();
	Devtools::start(Config {
		bridge: "127.0.0.1:9".parse().expect("addr"),
	})
}

#[tokio::test(flavor = "multi_thread")]
async fn a_saved_preset_connects_and_becomes_the_default() {
	let devtools = session();
	let name = format!("VM {}", std::process::id());
	let preset = DevicePreset::parse(&name, "100.64.0.7:9090").expect("valid");
	let revision = devtools.presets_revision();

	devtools.save_preset(preset.clone()).expect("saved");
	assert!(devtools.presets_revision() > revision);
	assert!(
		devtools.save_preset(preset).is_err(),
		"a duplicate is rejected"
	);

	devtools
		.connect_link(Some(&name.to_uppercase()))
		.expect("linked");

	let file = PresetFile::locate().expect("located");
	assert!(file.path().starts_with(config_dir()));
	let on_disk = file.load().expect("loaded");
	assert_eq!(on_disk.last_used.as_deref(), Some(name.as_str()));
	assert!(on_disk.auto_connect);
	let link = devtools.status().link.expect("linked");
	assert_eq!(link.name.as_deref(), Some(name.as_str()));
	assert_eq!(link.bridge.to_string(), "100.64.0.7:9090");

	devtools.remove_preset(&name).expect("removed");
	assert!(devtools.presets().expect("loaded").get(&name).is_none());
	assert!(
		devtools.status().link.is_none(),
		"removing the linked device drops the link"
	);
	assert!(devtools.connect_link(Some(&name)).is_err());
}
