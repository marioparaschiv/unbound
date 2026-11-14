//! The checker's project folder: the embedded declarations unpacked as `node_modules`, a tsconfig,
//! and the console's script files, which share one global scope.

use std::path::{Path, PathBuf};

include!(concat!(env!("OUT_DIR"), "/packages.rs"));

/// What the user is typing.
pub const BUFFER: &str = "console.ts";
/// Every entry that ran, so later entries see the variables earlier ones declared.
pub const HISTORY: &str = "history.ts";
/// `declare var $1: …` for each result, typed from the value's shape on the device.
pub const RESULTS: &str = "results.d.ts";
/// The scripts the console rewrites; their text lives in the server's open documents.
pub const SCRIPTS: [&str; 3] = [BUFFER, HISTORY, RESULTS];

const TSCONFIG: &str = r#"{
	"compilerOptions": {
		"target": "ES2022",
		"lib": ["ES2022"],
		"module": "ESNext",
		"moduleResolution": "bundler",
		"strict": true,
		"skipLibCheck": true,
		"noEmit": true,
		"types": []
	},
	"files": ["env.d.ts", "results.d.ts", "history.ts", "console.ts"]
}
"#;

/// The device's globals: Unbound's API, React and React Native, as a plugin sees them.
/// `@unbound-app/i18n` is generated per plugin, so the console gets a loose stand-in.
const ENV: &str = r#"import type {} from '@unbound-app/api/global';

declare module '@unbound-app/i18n' {
	export type Messages = Record<string, string>;
	export type MessageKey = string;
	export type FormatVars = Record<string, Record<string, string | number>>;
}
"#;

/// A stamp of the embedded declarations, so a build with different ones unpacks again.
fn stamp() -> String {
	let bytes: usize = PACKAGES.iter().map(|(_, contents)| contents.len()).sum();
	format!("{} {} {bytes}", env!("CARGO_PKG_VERSION"), PACKAGES.len())
}

fn unpack(root: &Path) -> anyhow::Result<()> {
	for (path, contents) in PACKAGES {
		let target = root.join("node_modules").join(path);
		if let Some(parent) = target.parent() {
			std::fs::create_dir_all(parent)?;
		}
		std::fs::write(target, contents)?;
	}
	std::fs::write(root.join("tsconfig.json"), TSCONFIG)?;
	std::fs::write(root.join("env.d.ts"), ENV)?;

	Ok(())
}

/// Unpacks the project under the cache folder when it is missing or stale, and empties the
/// console's scripts. Returns the folder.
pub fn prepare() -> anyhow::Result<PathBuf> {
	let root = dirs::cache_dir()
		.unwrap_or_else(std::env::temp_dir)
		.join("unbound-devtools")
		.join("console");
	let stamp_path = root.join(".stamp");
	let stamp = stamp();
	if std::fs::read_to_string(&stamp_path).ok().as_deref() != Some(stamp.as_str()) {
		let _ = std::fs::remove_dir_all(root.join("node_modules"));
		unpack(&root)?;
		std::fs::write(&stamp_path, stamp)?;
	}
	for script in SCRIPTS {
		std::fs::write(root.join(script), "")?;
	}

	Ok(root)
}
