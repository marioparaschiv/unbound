//! A link to this machine with nothing listening starts the bridge itself, through its launcher.
//! The harness's bridge stands in for `unbound-devtools serve-bridge`.
#![cfg(unix)]

use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

use unbound_devtools_core::bridge::Launcher;
use unbound_devtools_core::{BridgeState, Config, ConnectTarget, Devtools};

/// Runs the harness on the port after `--port`; `timeout` ends it, since the started bridge is
/// detached and outlives the test.
fn harness_launcher() -> Launcher {
	let script = concat!(env!("CARGO_MANIFEST_DIR"), "/../../harness/device.mjs");

	Launcher {
		program: "sh".to_owned(),
		prefix: vec![
			"-c".to_owned(),
			format!("exec timeout 20 bun '{script}' \"$3\""),
			"sh".to_owned(),
		],
	}
}

fn has_bun() -> bool {
	Command::new("bun")
		.arg("--version")
		.stdout(Stdio::null())
		.status()
		.is_ok_and(|status| status.success())
}

#[tokio::test(flavor = "multi_thread")]
async fn a_link_to_this_machine_starts_the_bridge() {
	if !has_bun() {
		eprintln!("skipping: cannot run `bun`; install bun to run the device harness");
		return;
	}

	let addr = std::net::TcpListener::bind("127.0.0.1:0")
		.and_then(|listener| listener.local_addr())
		.expect("a free port");
	let devtools = Devtools::start(Config {
		bridge: addr,
		bridge_launcher: Some(harness_launcher()),
	});
	let started = Instant::now();

	devtools.link_to(
		ConnectTarget {
			bridge: addr.into(),
		},
		None,
	);

	let mut changes = devtools.changes();
	let connected = async {
		loop {
			let state = devtools.status().link.map(|link| link.state);

			if matches!(state, Some(BridgeState::DeviceConnected)) {
				return;
			}

			changes.changed().await.expect("devtools alive");
		}
	};

	tokio::time::timeout(Duration::from_secs(15), connected)
		.await
		.unwrap_or_else(|_| panic!("never attached: {:?}", devtools.status().link));
	eprintln!("attached to the started bridge in {:?}", started.elapsed());
}
