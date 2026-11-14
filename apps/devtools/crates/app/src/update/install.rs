//! Installs an update in place: downloads the target's archive, checks its SHA-256, unpacks it
//! with the system `tar` (bsdtar on Windows reads the `.zip`) beside the install, and swaps it in.
//! On macOS the install is the `.app` bundle the executable runs from, else the executable.
//! Blocking; run it off the main thread.

use std::fs;
use std::io::{self, Read, Write};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::OnceLock;

use anyhow::{Context as _, bail};
use sha2::{Digest, Sha256};

use super::api::{Update, agent};

#[cfg(windows)]
const BINARY: &str = "unbound-devtools.exe";
#[cfg(not(windows))]
const BINARY: &str = "unbound-devtools";

/// Where the replaced install waits until it can be deleted; Windows can rename a running
/// executable but not delete it, so the next launch does.
fn replaced(root: &Path) -> PathBuf {
	root.with_extension("old")
}

/// The executable's path as launched. Read once at startup: after the swap, the OS reports the
/// running image's new name instead (`.old` on Windows, `<path> (deleted)` on Linux).
fn current_exe() -> anyhow::Result<PathBuf> {
	static EXE: OnceLock<Option<PathBuf>> = OnceLock::new();
	EXE.get_or_init(|| std::env::current_exe().ok())
		.clone()
		.context("Failed to find the running executable")
}

/// What an update replaces: the `.app` bundle when `exe` is its `Contents/MacOS` executable,
/// else `exe` itself.
fn install_root(exe: &Path) -> PathBuf {
	let in_macos_dir = exe.parent().and_then(Path::file_name) == Some("MacOS".as_ref());
	exe.ancestors()
		.nth(3)
		.filter(|app| in_macos_dir && app.extension().is_some_and(|ext| ext == "app"))
		.map_or_else(|| exe.to_path_buf(), Path::to_path_buf)
}

/// The unpacked counterpart of `root`: the archive's `.app` for a bundle, else the executable,
/// at the top level or inside a bundle (the macOS archive holds only the `.app`).
fn find_new(unpacked: &Path, root: &Path) -> io::Result<PathBuf> {
	let bundles = || -> io::Result<Vec<PathBuf>> {
		Ok(fs::read_dir(unpacked)?
			.filter_map(Result::ok)
			.map(|entry| entry.path())
			.filter(|path| path.extension().is_some_and(|ext| ext == "app") && path.is_dir())
			.collect())
	};
	let found = if root.extension().is_some_and(|ext| ext == "app") {
		bundles()?.into_iter().next()
	} else {
		let top = unpacked.join(BINARY);
		if top.is_file() {
			Some(top)
		} else {
			bundles()?
				.into_iter()
				.map(|app| app.join("Contents").join("MacOS").join(BINARY))
				.find(|path| path.is_file())
		}
	};
	found.ok_or_else(|| {
		io::Error::new(
			io::ErrorKind::NotFound,
			format!("the update has no {}", file_name(root)),
		)
	})
}

fn file_name(path: &Path) -> String {
	path.file_name()
		.map_or_else(String::new, |name| name.to_string_lossy().into_owned())
}

fn remove(path: &Path) {
	// Either kind may be absent; there is nothing to report.
	let _ = fs::remove_dir_all(path);
	let _ = fs::remove_file(path);
}

/// Deletes what the last update left behind and records the executable's path; runs at startup.
pub fn clean_up() {
	if let Ok(exe) = current_exe() {
		// Absent on every launch but the first after an update on Windows.
		remove(&replaced(&install_root(&exe)));
	}
}

/// Downloads, verifies and installs `update` over the running install.
pub fn install(update: &Update) -> anyhow::Result<()> {
	let root = install_root(&current_exe()?);
	let work = std::env::temp_dir().join(format!("unbound-devtools-update-{}", std::process::id()));
	// Unpacked beside the install, so the swap is a rename on one volume.
	let unpacked = root.with_file_name(format!(".unbound-devtools-update-{}", std::process::id()));
	// A previous attempt from this process may have left files behind.
	remove(&work);
	remove(&unpacked);
	fs::create_dir_all(&work).context("Failed to create the download folder")?;
	let result = (|| {
		let archive = work.join(archive_name(&update.url));
		download(&update.url, &archive, &update.sha256)?;
		fs::create_dir_all(&unpacked)
			.with_context(|| format!("Failed to create {}", unpacked.display()))?;
		unpack(&archive, &unpacked)?;
		replace(&root, &find_new(&unpacked, &root)?)
			.with_context(|| format!("Failed to replace {}", root.display()))
	})();
	remove(&work);
	remove(&unpacked);
	result
}

fn archive_name(url: &str) -> &str {
	url.rsplit('/')
		.next()
		.filter(|name| !name.is_empty())
		.unwrap_or("update")
}

/// Streams `url` to `path`, failing unless its SHA-256 is `expected`.
fn download(url: &str, path: &Path, expected: &str) -> anyhow::Result<()> {
	let reader = agent()
		.get(url)
		.call()
		.context("Failed to download the update")?
		.into_body()
		.into_reader();
	verify(path, reader, expected)
}

/// Writes `reader` to `path` while hashing it, failing unless its SHA-256 is `expected`.
fn verify(path: &Path, mut reader: impl Read, expected: &str) -> anyhow::Result<()> {
	let mut file = fs::File::create(path)?;
	let mut hasher = Sha256::new();
	let mut buffer = vec![0; 64 * 1024];
	loop {
		let read = reader
			.read(&mut buffer)
			.context("Failed to download the update")?;
		if read == 0 {
			break;
		}
		hasher.update(&buffer[..read]);
		file.write_all(&buffer[..read])?;
	}
	file.flush()?;
	let actual = format!("{:x}", hasher.finalize());
	if !actual.eq_ignore_ascii_case(expected) {
		bail!("The download is damaged: its SHA-256 is {actual}, not {expected}");
	}
	Ok(())
}

fn tar() -> Command {
	#[cfg(windows)]
	{
		use std::os::windows::process::CommandExt;
		const CREATE_NO_WINDOW: u32 = 0x0800_0000;
		// The system's bsdtar, not a GNU tar from Git on PATH, which cannot read a zip.
		let root = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
		let mut command = Command::new(PathBuf::from(root).join("System32").join("tar.exe"));
		command.creation_flags(CREATE_NO_WINDOW);
		command
	}
	#[cfg(not(windows))]
	Command::new("tar")
}

fn unpack(archive: &Path, into: &Path) -> anyhow::Result<()> {
	let output = tar()
		.arg("-xf")
		.arg(archive)
		.arg("-C")
		.arg(into)
		.output()
		.context("Failed to run tar to unpack the update")?;
	if !output.status.success() {
		bail!(
			"tar could not unpack the update: {}",
			String::from_utf8_lossy(&output.stderr).trim()
		);
	}
	Ok(())
}

/// Moves `new` (an executable or a `.app`, on the same volume) to `root`. A failure puts the
/// old install back, so `root` is never left missing.
fn replace(root: &Path, new: &Path) -> io::Result<()> {
	#[cfg(unix)]
	if new.is_file() {
		use std::os::unix::fs::PermissionsExt;
		fs::set_permissions(new, fs::Permissions::from_mode(0o755))?;
	}
	// Unix renames a file over the running executable in one step; a bundle or a Windows
	// executable moves aside first.
	if cfg!(unix) && new.is_file() {
		return fs::rename(new, root);
	}
	let old = replaced(root);
	remove(&old);
	fs::rename(root, &old)?;
	if let Err(error) = fs::rename(new, root) {
		let _ = fs::rename(&old, root);
		return Err(error);
	}
	if cfg!(unix) {
		remove(&old);
	}
	Ok(())
}

/// Starts the installed executable with this run's arguments; the caller quits.
pub fn relaunch() -> anyhow::Result<()> {
	Command::new(current_exe()?)
		.args(std::env::args_os().skip(1))
		.spawn()
		.context("Failed to start the updated DevTools")?;
	Ok(())
}

#[cfg(test)]
mod tests {
	use std::fs;
	use std::path::Path;

	use super::{BINARY, archive_name, find_new, install_root, replace, verify};

	fn scratch(name: &str) -> std::path::PathBuf {
		let dir = std::env::temp_dir().join(format!("devtools-{name}-{}", std::process::id()));
		let _ = fs::remove_dir_all(&dir);
		fs::create_dir_all(&dir).unwrap();
		dir
	}

	fn bundle(dir: &Path, contents: &str) -> std::path::PathBuf {
		let app = dir.join("Unbound DevTools.app");
		let macos = app.join("Contents").join("MacOS");
		fs::create_dir_all(&macos).unwrap();
		fs::write(macos.join(BINARY), contents).unwrap();
		app
	}

	#[test]
	fn names_the_archive_after_the_url() {
		assert_eq!(
			archive_name("https://example.com/download/unbound-devtools-linux-x64.tar.gz"),
			"unbound-devtools-linux-x64.tar.gz"
		);
		assert_eq!(archive_name("https://example.com/"), "update");
	}

	#[test]
	fn an_executable_in_a_bundle_installs_as_the_bundle() {
		let app = Path::new("/Applications/Unbound DevTools.app");
		let exe = app.join("Contents").join("MacOS").join(BINARY);
		assert_eq!(install_root(&exe), app);
		let bare = Path::new("/home/me/bin").join(BINARY);
		assert_eq!(install_root(&bare), bare);
	}

	#[test]
	fn replaces_an_executable_with_the_unpacked_one() {
		let dir = scratch("replace");
		fs::create_dir_all(dir.join("payload")).unwrap();
		let exe = dir.join(BINARY);
		fs::write(&exe, "old").unwrap();
		fs::write(dir.join("payload").join(BINARY), "new").unwrap();
		#[cfg(not(windows))]
		{
			let archive = dir.join("payload.tar.gz");
			let status = std::process::Command::new("tar")
				.arg("-czf")
				.arg(&archive)
				.arg("-C")
				.arg(dir.join("payload"))
				.arg(BINARY)
				.status()
				.unwrap();
			assert!(status.success());
			let unpacked = dir.join("unpacked");
			fs::create_dir_all(&unpacked).unwrap();
			super::unpack(&archive, &unpacked).unwrap();
			replace(&exe, &find_new(&unpacked, &exe).unwrap()).unwrap();
		}
		#[cfg(windows)]
		replace(&exe, &find_new(&dir.join("payload"), &exe).unwrap()).unwrap();
		assert_eq!(fs::read_to_string(&exe).unwrap(), "new");
		assert!(find_new(&dir.join("missing"), &exe).is_err());
		fs::remove_dir_all(&dir).unwrap();
	}

	#[test]
	fn replaces_a_bundle_and_reads_a_bare_executable_out_of_one() {
		let dir = scratch("bundle");
		let installed = bundle(&dir, "old");
		let unpacked = dir.join("unpacked");
		let new = bundle(&unpacked, "new");
		fs::write(new.join("Contents").join("Info.plist"), "plist").unwrap();

		replace(&installed, &find_new(&unpacked, &installed).unwrap()).unwrap();
		let exe = installed.join("Contents").join("MacOS").join(BINARY);
		assert_eq!(fs::read_to_string(&exe).unwrap(), "new");
		assert!(installed.join("Contents").join("Info.plist").is_file());
		#[cfg(unix)]
		assert!(!dir.join("Unbound DevTools.old").exists());

		let bare = dir.join(BINARY);
		fs::write(&bare, "old").unwrap();
		let again = dir.join("again");
		bundle(&again, "newer");
		replace(&bare, &find_new(&again, &bare).unwrap()).unwrap();
		assert_eq!(fs::read_to_string(&bare).unwrap(), "newer");
		fs::remove_dir_all(&dir).unwrap();
	}

	#[test]
	fn refuses_a_download_with_the_wrong_digest() {
		let path = std::env::temp_dir().join(format!("devtools-download-{}", std::process::id()));
		let error = verify(&path, &b"payload"[..], &"0".repeat(64)).unwrap_err();
		assert!(error.to_string().contains("damaged"));
		// sha256("payload")
		let digest = "239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5";
		verify(&path, &b"payload"[..], digest).unwrap();
		assert_eq!(fs::read(&path).unwrap(), b"payload");
		fs::remove_file(&path).unwrap();
	}
}
