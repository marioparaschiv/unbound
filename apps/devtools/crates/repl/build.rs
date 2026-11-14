//! Embeds `types/packages`, the declarations the checker reads, as a table of `(path, bytes)` the
//! crate unpacks into its project folder as `node_modules`.

use std::fmt::Write as _;
use std::path::{Path, PathBuf};

fn walk(dir: &Path, files: &mut Vec<PathBuf>) {
	let mut entries: Vec<_> = std::fs::read_dir(dir)
		.expect("types/packages is readable")
		.map(|entry| entry.expect("a readable entry").path())
		.collect();
	entries.sort();
	for path in entries {
		if path.is_dir() {
			walk(&path, files);
		} else {
			files.push(path);
		}
	}
}

fn main() {
	let manifest = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").expect("cargo sets it"));
	let root = manifest.join("types").join("packages");
	println!("cargo:rerun-if-changed={}", root.display());
	let mut files = Vec::new();
	walk(&root, &mut files);
	let mut table = String::from("pub static PACKAGES: &[(&str, &[u8])] = &[\n");
	for file in &files {
		let relative = file
			.strip_prefix(&root)
			.expect("under the root")
			.to_string_lossy()
			.replace('\\', "/");
		writeln!(
			table,
			"\t({relative:?}, include_bytes!({:?})),",
			file.display().to_string()
		)
		.expect("writing to a String");
	}
	table.push_str("];\n");
	let out = PathBuf::from(std::env::var("OUT_DIR").expect("cargo sets it"));
	std::fs::write(out.join("packages.rs"), table).expect("OUT_DIR is writable");
}
