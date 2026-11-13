//! Runs `ubd` as a child process and streams what it prints.

use std::path::PathBuf;
use std::process::Stdio;
use std::time::Duration;

use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::process::Command;
use tokio::runtime::Handle;
use tokio::sync::{mpsc, oneshot};

use super::argv::Launcher;
use super::catalog::{Catalog, CatalogError};
use super::failure::CommandError;

/// The flag that makes `ubd` print one JSON line, and a failure's reason with it.
pub const JSON_FLAG: &str = "--json";

/// How long `ubd catalog` may take; `bunx` can be downloading the CLI the first time.
const CATALOG_TIMEOUT: Duration = Duration::from_secs(60);
/// How long Stop waits for a polite exit, and for output still in the pipes.
const STOP_GRACE: Duration = Duration::from_secs(2);

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Stream {
	Stdout,
	Stderr,
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RunEvent {
	Line(Stream, String),
	/// Why a `--json` run failed, read from its last stdout line; sent just before [`RunEvent::Exited`].
	Error(CommandError),
	/// The exit code; `None` when a signal ended it, as Stop does.
	Exited(Option<i32>),
	/// The program could not start.
	Failed(String),
}

/// A running command: its output arrives on `events`, and dropping `stop` (or sending) kills it.
pub struct Run {
	pub events: mpsc::UnboundedReceiver<RunEvent>,
	pub stop: oneshot::Sender<()>,
}

fn command(launcher: &Launcher, args: &[String], cwd: Option<&PathBuf>) -> Command {
	let mut command = Command::new(&launcher.program);
	command
		.args(launcher.argv(args))
		.stdin(Stdio::null())
		.stdout(Stdio::piped())
		.stderr(Stdio::piped())
		// The transcript is plain text; picocolors reads these.
		.env("NO_COLOR", "1")
		.env("FORCE_COLOR", "0")
		.kill_on_drop(true);
	if let Some(cwd) = cwd {
		command.current_dir(cwd);
	}
	// Its own process group, so Stop also ends what a wrapper such as `bunx` started.
	#[cfg(unix)]
	command.process_group(0);
	#[cfg(windows)]
	command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
	command
}

/// Ends the child and everything it started: SIGTERM to its group, then SIGKILL if it lingers.
async fn stop_tree(child: &mut tokio::process::Child) -> std::io::Result<std::process::ExitStatus> {
	let Some(pid) = child.id() else {
		return child.wait().await;
	};
	#[cfg(unix)]
	{
		let group = -(pid as i32);
		// SAFETY: kill(2) with a negative pid signals that process group; it touches no memory.
		unsafe { libc::kill(group, libc::SIGTERM) };
		if let Ok(status) = tokio::time::timeout(STOP_GRACE, child.wait()).await {
			return status;
		}
		// SAFETY: as above.
		unsafe { libc::kill(group, libc::SIGKILL) };
	}
	#[cfg(windows)]
	{
		let _ = Command::new("taskkill")
			.args(["/PID", &pid.to_string(), "/T", "/F"])
			.creation_flags(0x0800_0000)
			.status()
			.await;
	}
	let _ = child.start_kill();
	child.wait().await
}

/// Sends each line as it arrives; returns the last one.
async fn forward(
	reader: impl AsyncRead + Unpin,
	stream: Stream,
	events: mpsc::UnboundedSender<RunEvent>,
) -> Option<String> {
	let mut lines = BufReader::new(reader).lines();
	let mut last = None;
	while let Ok(Some(line)) = lines.next_line().await {
		// A progress line redraws itself with `\r`; only its last state is worth keeping.
		let line = line.rsplit('\r').next().unwrap_or_default().to_owned();
		last = Some(line.clone());
		if events.send(RunEvent::Line(stream, line)).is_err() {
			break;
		}
	}
	last
}

/// Starts `launcher args…` in `cwd` on `runtime`. When `args` hold [`JSON_FLAG`] and the run fails,
/// its reason arrives as [`RunEvent::Error`].
pub fn spawn(runtime: &Handle, launcher: &Launcher, args: &[String], cwd: Option<PathBuf>) -> Run {
	let json = args.iter().any(|arg| arg == JSON_FLAG);
	let (sender, events) = mpsc::unbounded_channel();
	let (stop, stopped) = oneshot::channel::<()>();
	let mut command = command(launcher, args, cwd.as_ref());
	runtime.spawn(async move {
		let mut child = match command.spawn() {
			Ok(child) => child,
			Err(error) => {
				let _ = sender.send(RunEvent::Failed(error.to_string()));
				return;
			}
		};
		let stdout = child
			.stdout
			.take()
			.map(|out| tokio::spawn(forward(out, Stream::Stdout, sender.clone())));
		let stderr = child
			.stderr
			.take()
			.map(|err| tokio::spawn(forward(err, Stream::Stderr, sender.clone())));
		let status = tokio::select! {
			status = child.wait() => status,
			_ = stopped => stop_tree(&mut child).await,
		};
		// Drain what the child printed before it exited, so the exit line comes last. A grandchild
		// that outlives it can hold the pipes open, so the drain is bounded.
		let mut last_stdout = None;
		for (ix, task) in [stdout, stderr].into_iter().enumerate() {
			let Some(mut task) = task else { continue };
			match tokio::time::timeout(STOP_GRACE, &mut task).await {
				Ok(Ok(last)) if ix == 0 => last_stdout = last,
				Ok(_) => {}
				Err(_) => task.abort(),
			}
		}
		let failed = matches!(&status, Ok(status) if status.code().is_some_and(|code| code != 0));
		if json
			&& failed && let Some(error) = last_stdout
			.as_deref()
			.and_then(CommandError::from_json_line)
		{
			let _ = sender.send(RunEvent::Error(error));
		}
		let _ = sender.send(match status {
			Ok(status) => RunEvent::Exited(status.code()),
			Err(error) => RunEvent::Failed(error.to_string()),
		});
	});
	Run { events, stop }
}

#[derive(Debug, thiserror::Error)]
pub enum LoadError {
	#[error("could not run {program}: {reason}")]
	Spawn { program: String, reason: String },
	#[error("{program} catalog timed out")]
	Timeout { program: String },
	#[error("{program} catalog failed: {output}")]
	Failed { program: String, output: String },
	#[error(transparent)]
	Catalog(#[from] CatalogError),
}

/// Asks `ubd catalog` which commands this `ubd` has.
pub async fn load_catalog(launcher: &Launcher, cwd: Option<PathBuf>) -> Result<Catalog, LoadError> {
	let program = launcher.program.clone();
	let output = command(launcher, &["catalog".to_owned()], cwd.as_ref()).output();
	let output = match tokio::time::timeout(CATALOG_TIMEOUT, output).await {
		Err(_) => return Err(LoadError::Timeout { program }),
		Ok(Err(error)) => {
			return Err(LoadError::Spawn {
				program,
				reason: error.to_string(),
			});
		}
		Ok(Ok(output)) => output,
	};
	let stdout = String::from_utf8_lossy(&output.stdout);
	if !output.status.success() {
		let stderr = String::from_utf8_lossy(&output.stderr);
		let text = if stderr.trim().is_empty() {
			stdout
		} else {
			stderr
		};
		return Err(LoadError::Failed {
			program,
			output: text.trim().to_owned(),
		});
	}
	Ok(Catalog::parse(stdout.trim())?)
}
