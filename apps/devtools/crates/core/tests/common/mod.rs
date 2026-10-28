#![allow(dead_code)]

use std::net::SocketAddr;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use unbound_devtools_core::query::{self, FindQuery, NameMatch};
use unbound_devtools_core::{Config, ConnectionState, Devtools, ElementId, PathSegment};

/// `harness/device.mjs` under bun; killed on drop.
pub struct Device(Child);

impl Device {
	pub fn kill(&mut self) {
		let _ = self.0.kill();
		let _ = self.0.wait();
	}
}

impl Drop for Device {
	fn drop(&mut self) {
		self.kill();
	}
}

pub fn key(segment: &str) -> PathSegment {
	PathSegment::Key(segment.to_owned())
}

/// A session on an ephemeral port. The bridge address points at a closed port.
pub fn session() -> (Devtools, SocketAddr) {
	let devtools = Devtools::start(Config {
		listen: "127.0.0.1:0".parse().expect("valid addr"),
		bridge: "127.0.0.1:9".parse().expect("valid addr"),
		advertise_host: None,
	});
	let ConnectionState::Listening { addr } = devtools.status().connection else {
		panic!(
			"listening on an ephemeral port: {:?}",
			devtools.status().connection
		);
	};

	(devtools, addr)
}

/// The harness device; with `tick_ms` it re-renders with 3 to 7 messages on that interval.
pub fn spawn_device(port: u16, tick_ms: Option<u32>) -> Option<Device> {
	let script = concat!(env!("CARGO_MANIFEST_DIR"), "/../../harness/device.mjs");
	let mut command = Command::new("bun");

	if let Some(tick_ms) = tick_ms {
		command.env("TICK_MS", tick_ms.to_string());
	}

	let child = command
		.arg(script)
		.arg(port.to_string())
		.stdout(Stdio::null())
		.stderr(Stdio::inherit())
		.spawn();

	match child {
		Ok(child) => Some(Device(child)),
		Err(error) => {
			eprintln!(
				"skipping: cannot run `bun` ({error}); install bun to run the device harness"
			);
			None
		}
	}
}

/// A session with the harness device attached and its tree loaded, or `None` without bun.
pub async fn connected_session() -> Option<(Devtools, Device)> {
	let (devtools, addr) = session();
	let device = spawn_device(addr.port(), None)?;

	wait_for(&devtools, "MessageRow from the device", |devtools| {
		devtools
			.store()
			.walk(None)
			.any(|element| &*element.name == "MessageRow")
	})
	.await;
	settle(&devtools).await;

	Some((devtools, device))
}

/// Waits out the remount the session's on-connect filter update triggers, which reassigns ids.
pub async fn settle(devtools: &Devtools) {
	let mut changes = devtools.changes();

	while tokio::time::timeout(Duration::from_millis(400), changes.changed())
		.await
		.is_ok()
	{}
}

/// Waits on [`Devtools::changes`] until `ready` holds, failing after 15 s.
pub async fn wait_for(devtools: &Devtools, what: &str, ready: impl Fn(&Devtools) -> bool) {
	let mut changes = devtools.changes();
	let deadline = tokio::time::Instant::now() + Duration::from_secs(15);

	while !ready(devtools) {
		let changed = tokio::time::timeout_at(deadline, changes.changed()).await;
		assert!(
			matches!(changed, Ok(Ok(()))),
			"timed out waiting for {what}"
		);
	}
}

pub fn find_one(devtools: &Devtools, name: &str, key: Option<&str>) -> ElementId {
	let ids = query::find(
		&devtools.store(),
		&FindQuery {
			name: Some(NameMatch::Exact(name.to_owned())),
			key: key.map(str::to_owned),
			..Default::default()
		},
	);

	assert_eq!(ids.len(), 1, "exactly one <{name} key={key:?}>");
	ids[0]
}
