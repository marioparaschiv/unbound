//! Installs an update in place: downloads the target's archive, checks its SHA-256, unpacks it
//! with the system `tar` (bsdtar on Windows reads the `.zip`), and swaps the running executable.
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

/// Where Windows keeps the replaced executable until the next launch deletes it; a running
/// executable can be renamed there but not deleted.
fn replaced(exe: &Path) -> PathBuf {
	exe.with_extension("old")
}

/// The executable's path as launched. Read once at startup: after the swap, the OS reports the
/// running image's new name instead (`.old` on Windows, `<path> (deleted)` on Linux).
fn current_exe() -> anyhow::Result<PathBuf> {
	static EXE: OnceLock<Option<PathBuf>> = OnceLock::new();
	EXE.get_or_init(|| std::env::current_exe().ok())
		.clone()
		.context("Failed to find the running executable")
}

/// Deletes what the last update left behind and records the executable's path; runs at startup.
pub fn clean_up() {
	if let Ok(exe) = current_exe() {
		// Absent on every launch but the first after an update.
		let _ = fs::remove_file(replaced(&exe));
	}
}

/// Downloads, verifies and installs `update` over the running executable.
pub fn install(update: &Update) -> anyhow::Result<()> {
	let exe = current_exe()?;
	let work = std::env::temp_dir().join(format!("unbound-devtools-update-{}", std::process::id()));
	// A previous attempt from this process may have left files behind.
	let _ = fs::remove_dir_all(&work);
	fs::create_dir_all(&work).context("Failed to create the download folder")?;
	let result = (|| {
		let archive = work.join(archive_name(&update.url));
		download(&update.url, &archive, &update.sha256)?;
		let unpacked = work.join("unpacked");
		fs::create_dir_all(&unpacked)?;
		unpack(&archive, &unpacked)?;
		replace(&exe, &unpacked.join(BINARY))
			.with_context(|| format!("Failed to replace {}", exe.display()))
	})();
	let _ = fs::remove_dir_all(&work);
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

/// Puts `new` where `exe` is. The new file is staged beside `exe` first, so the final step is a
/// rename on one volume and a failure never leaves `exe` missing.
fn replace(exe: &Path, new: &Path) -> io::Result<()> {
	if !new.is_file() {
		return Err(io::Error::new(
			io::ErrorKind::NotFound,
			format!("the update has no {BINARY}"),
		));
	}
	let staged = exe.with_extension("update");
	fs::copy(new, &staged)?;
	#[cfg(unix)]
	{
		use std::os::unix::fs::PermissionsExt;
		fs::set_permissions(&staged, fs::Permissions::from_mode(0o755))?;
	}
	#[cfg(windows)]
	{
		let old = replaced(exe);
		let _ = fs::remove_file(&old);
		fs::rename(exe, &old)?;
		if let Err(error) = fs::rename(&staged, exe) {
			// Put the running executable back so the next launch still finds it.
			let _ = fs::rename(&old, exe);
			let _ = fs::remove_file(&staged);
			return Err(error);
		}
	}
	#[cfg(not(windows))]
	if let Err(error) = fs::rename(&staged, exe) {
		let _ = fs::remove_file(&staged);
		return Err(error);
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
	use super::{BINARY, archive_name, replace, verify};

	#[test]
	fn names_the_archive_after_the_url() {
		assert_eq!(
			archive_name("https://example.com/download/unbound-devtools-linux-x64.tar.gz"),
			"unbound-devtools-linux-x64.tar.gz"
		);
		assert_eq!(archive_name("https://example.com/"), "update");
	}

	#[test]
	fn replaces_an_executable_with_the_unpacked_one() {
		let dir = std::env::temp_dir().join(format!("devtools-replace-{}", std::process::id()));
		std::fs::create_dir_all(dir.join("payload")).unwrap();
		let exe = dir.join(BINARY);
		std::fs::write(&exe, "old").unwrap();
		std::fs::write(dir.join("payload").join(BINARY), "new").unwrap();
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
			std::fs::create_dir_all(&unpacked).unwrap();
			super::unpack(&archive, &unpacked).unwrap();
			replace(&exe, &unpacked.join(BINARY)).unwrap();
		}
		#[cfg(windows)]
		replace(&exe, &dir.join("payload").join(BINARY)).unwrap();
		assert_eq!(std::fs::read_to_string(&exe).unwrap(), "new");
		assert!(replace(&exe, &dir.join("missing")).is_err());
		std::fs::remove_dir_all(&dir).unwrap();
	}

	#[test]
	fn refuses_a_download_with_the_wrong_digest() {
		let path = std::env::temp_dir().join(format!("devtools-download-{}", std::process::id()));
		let error = verify(&path, &b"payload"[..], &"0".repeat(64)).unwrap_err();
		assert!(error.to_string().contains("damaged"));
		// sha256("payload")
		let digest = "239f59ed55e737c77147cf55ad0c1b030b6d7ee748a7426952f9b852d5a935e5";
		verify(&path, &b"payload"[..], digest).unwrap();
		assert_eq!(std::fs::read(&path).unwrap(), b"payload");
		std::fs::remove_file(&path).unwrap();
	}
}
