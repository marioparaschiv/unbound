//! Starts this machine's debugger bridge when nothing listens: `<program> serve-bridge` detached,
//! logging to the system temporary directory. The app runs itself, so it needs no `ubd`. The bridge
//! exits once no controller has been attached for a while, so nothing here stops it.

use std::fs::OpenOptions;
use std::net::SocketAddr;
use std::process::{Command, Stdio};
use std::time::Duration;

use tokio::net::TcpStream;
use tokio::time::{self, Instant};

/// The program that serves the bridge, and the words it takes before `serve-bridge`: this app's
/// own executable with none, or a test's stand-in.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Launcher {
	pub program: String,
	pub prefix: Vec<String>,
}

impl Launcher {
	/// The whole argv after the program: the launcher's own words, then `args`.
	pub fn argv(&self, args: &[String]) -> Vec<String> {
		self.prefix.iter().chain(args).cloned().collect()
	}
}

/// `@unbound-app/debugger-protocol`'s `SERVE_BRIDGE_COMMAND`, checked in `bridge::contract`.
pub(crate) const SERVE_BRIDGE_COMMAND: &str = "serve-bridge";
/// Generous for a cold start on a slow disk; this app's own bridge listens within milliseconds.
const LISTEN_TIMEOUT: Duration = Duration::from_secs(15);
const LISTEN_POLL: Duration = Duration::from_millis(20);

/// Runs `<launcher> serve-bridge --port <port>` in its own process group, so it outlives this app.
pub(crate) fn start(launcher: &Launcher, port: u16) -> std::io::Result<()> {
	let log = std::env::temp_dir().join(format!("unbound-bridge-{port}.log"));
	let output = OpenOptions::new().create(true).append(true).open(log)?;
	let args = [
		SERVE_BRIDGE_COMMAND.to_owned(),
		"--port".to_owned(),
		port.to_string(),
	];
	let mut command = Command::new(&launcher.program);

	command
		.args(launcher.argv(&args))
		.stdin(Stdio::null())
		.stdout(output.try_clone()?)
		.stderr(output);
	detach(&mut command);

	let mut child = command.spawn()?;

	// Reaped on its own thread, so an exited bridge never lingers as a zombie while this app runs.
	std::thread::spawn(move || child.wait());

	Ok(())
}

/// Whether something accepts connections on `address` within [`LISTEN_TIMEOUT`].
pub(crate) async fn wait_listening(address: SocketAddr) -> bool {
	let deadline = Instant::now() + LISTEN_TIMEOUT;

	while Instant::now() < deadline {
		if TcpStream::connect(address).await.is_ok() {
			return true;
		}

		time::sleep(LISTEN_POLL).await;
	}

	false
}

#[cfg(unix)]
fn detach(command: &mut Command) {
	use std::os::unix::process::CommandExt;

	// Its own group, so a Ctrl-C meant for this app in a terminal does not reach the bridge.
	command.process_group(0);
}

#[cfg(windows)]
fn detach(command: &mut Command) {
	use std::os::windows::process::CommandExt;

	const DETACHED_PROCESS: u32 = 0x0000_0008;
	const CREATE_NEW_PROCESS_GROUP: u32 = 0x0000_0200;

	command.creation_flags(DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP);
}
