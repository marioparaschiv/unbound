//! The debugger connection against a fake bridge that stays open, like the real one.

use std::net::SocketAddr;
use std::sync::OnceLock;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::{Value as Json, json};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;
use unbound_devtools_core::presets::CONFIG_DIR_ENV;
use unbound_devtools_core::{
	BridgeState, Config, ConnectTarget, ConnectionState, Devtools, LinkStatus, bridge,
};

fn config_dir() {
	static DIR: OnceLock<()> = OnceLock::new();
	DIR.get_or_init(|| {
		let dir =
			std::env::temp_dir().join(format!("unbound-devtools-link-{}", std::process::id()));
		let _ = std::fs::remove_dir_all(&dir);
		// SAFETY: set once, before any test reads it, under the OnceLock.
		unsafe { std::env::set_var(CONFIG_DIR_ENV, dir) };
	});
}

/// Accepts controllers forever: announces a device, answers each eval with `reply`, and reports
/// each eval's code.
async fn fake_bridge(reply: Json) -> (SocketAddr, mpsc::UnboundedReceiver<String>) {
	let listener = TcpListener::bind("127.0.0.1:0")
		.await
		.expect("bridge binds");
	let addr = listener.local_addr().expect("bridge addr");
	let (code_tx, code_rx) = mpsc::unbounded_channel();

	tokio::spawn(async move {
		while let Ok((stream, _)) = listener.accept().await {
			let reply = reply.clone();
			let code_tx = code_tx.clone();
			tokio::spawn(async move {
				let mut socket = tokio_tungstenite::accept_async(stream)
					.await
					.expect("handshake");
				let device = json!({
					"platform": "ios",
					"discordVersion": "300.0",
					"loaderVersion": "1.0.0",
					"clientVersion": "2.0.0",
				});
				let status =
					json!({ "type": "device-status", "connected": true, "device": device });
				socket
					.send(Message::text(status.to_string()))
					.await
					.expect("status sends");

				while let Some(Ok(Message::Text(text))) = socket.next().await {
					let request: Json = serde_json::from_str(&text).expect("JSON request");
					let mut result = reply.clone();
					result["type"] = json!("eval-result");
					result["id"] = request["id"].clone();
					let _ = socket.send(Message::text(result.to_string())).await;
					let _ = code_tx.send(request["code"].as_str().unwrap_or_default().to_owned());
				}
			});
		}
	});

	(addr, code_rx)
}

fn session() -> (Devtools, u16) {
	config_dir();
	let devtools = Devtools::start(Config {
		listen: "127.0.0.1:0".parse().expect("addr"),
		bridge: "127.0.0.1:9".parse().expect("addr"),
		advertise_host: None,
	});
	let ConnectionState::Listening { addr } = devtools.status().connection else {
		panic!("listening");
	};

	(devtools, addr.port())
}

/// Waits up to 5 s for the link to satisfy `done`.
async fn link_until(devtools: &Devtools, done: impl Fn(&LinkStatus) -> bool) -> LinkStatus {
	let mut changes = devtools.changes();
	let wait = async {
		loop {
			if let Some(link) = devtools.status().link.filter(|link| done(link)) {
				return link;
			}
			changes.changed().await.expect("devtools alive");
		}
	};

	tokio::time::timeout(Duration::from_secs(5), wait)
		.await
		.unwrap_or_else(|_| panic!("link never settled: {:?}", devtools.status().link))
}

#[tokio::test(flavor = "multi_thread")]
async fn a_link_asks_an_attached_device_to_dial() {
	let (bridge_addr, mut codes) = fake_bridge(json!({ "ok": true, "value": "ws://x" })).await;
	let (devtools, port) = session();

	devtools.link_to(
		ConnectTarget {
			bridge: bridge_addr.into(),
			advertise_host: Some("100.64.0.5".to_owned()),
		},
		None,
	);

	let code = tokio::time::timeout(Duration::from_secs(5), codes.recv())
		.await
		.expect("the link evals")
		.expect("a code");
	assert_eq!(code, bridge::connect_script(Some("100.64.0.5"), port));
	let link = link_until(&devtools, |link| {
		matches!(link.state, BridgeState::DeviceConnected) && link.device.is_some()
	})
	.await;
	assert_eq!(link.device.expect("device").discord_version, "300.0");
	assert!(link.error.is_none());
}

#[tokio::test(flavor = "multi_thread")]
async fn a_link_keeps_the_devices_error() {
	let (bridge_addr, _codes) =
		fake_bridge(json!({ "ok": false, "error": "React DevTools is not loaded" })).await;
	let (devtools, _) = session();

	devtools.link_to(
		ConnectTarget {
			bridge: bridge_addr.into(),
			advertise_host: None,
		},
		None,
	);

	let link = link_until(&devtools, |link| link.error.is_some()).await;
	assert_eq!(link.error.as_deref(), Some("React DevTools is not loaded"));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_link_to_a_dead_bridge_retries() {
	let (devtools, _) = session();

	devtools.link_to(
		ConnectTarget {
			bridge: "127.0.0.1:9".parse().expect("addr"),
			advertise_host: None,
		},
		Some("Gone".to_owned()),
	);

	let link = link_until(&devtools, |link| {
		matches!(link.state, BridgeState::Unreachable)
	})
	.await;
	assert_eq!(link.name.as_deref(), Some("Gone"));
	assert!(link.error.is_some());

	devtools.unlink();
	assert!(devtools.status().link.is_none());
}

#[tokio::test(flavor = "multi_thread")]
async fn the_link_is_restored_at_launch_until_disconnected() {
	let (devtools, _) = session();

	devtools.connect_link(None).expect("linked");
	drop(devtools);

	let (devtools, _) = session();
	devtools.resume_link();
	assert!(devtools.status().link.is_some(), "restored");

	devtools.disconnect_link();
	drop(devtools);

	let (devtools, _) = session();
	devtools.resume_link();
	assert!(devtools.status().link.is_none(), "stays off");
}
