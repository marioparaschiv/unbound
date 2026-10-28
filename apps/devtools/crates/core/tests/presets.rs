//! Saved devices through the session: `connect_device_to` and `connect_preset` against an in-test
//! debugger bridge, with `devices.json` in a private config dir.

use std::net::SocketAddr;
use std::sync::OnceLock;

use futures_util::{SinkExt, StreamExt};
use serde_json::{Value as Json, json};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio_tungstenite::tungstenite::Message;
use unbound_devtools_core::presets::{CONFIG_DIR_ENV, PresetFile};
use unbound_devtools_core::{
	BridgeState, Config, ConnectTarget, ConnectionState, DevicePreset, Devtools, bridge,
};

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

/// Accepts one controller, reports a device, answers its eval with `url` and hands back the code.
async fn fake_bridge(url: &str) -> (SocketAddr, oneshot::Receiver<String>) {
	let listener = TcpListener::bind("127.0.0.1:0").await.expect("bridge binds");
	let addr = listener.local_addr().expect("bridge addr");
	let (code_tx, code_rx) = oneshot::channel();
	let url = url.to_owned();

	tokio::spawn(async move {
		let (stream, _) = listener.accept().await.expect("controller dials");
		let mut socket = tokio_tungstenite::accept_async(stream).await.expect("handshake");
		let status = json!({ "type": "device-status", "connected": true });
		socket.send(Message::text(status.to_string())).await.expect("status sends");

		let Some(Ok(Message::Text(text))) = socket.next().await else {
			return;
		};
		let request: Json = serde_json::from_str(&text).expect("JSON request");
		let result = json!({ "type": "eval-result", "id": request["id"], "ok": true, "value": url });
		socket.send(Message::text(result.to_string())).await.expect("result sends");
		let _ = code_tx.send(request["code"].as_str().unwrap_or_default().to_owned());
	});

	(addr, code_rx)
}

/// A session whose own bridge is a closed port, so only a target or preset can reach a device.
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

#[tokio::test(flavor = "multi_thread")]
async fn connect_device_to_reaches_the_targets_bridge() {
	let (bridge_addr, code) = fake_bridge("ws://100.64.0.5:8097").await;
	let (devtools, port) = session();
	let target = ConnectTarget {
		bridge: bridge_addr.into(),
		advertise_host: Some("100.64.0.5".to_owned()),
	};

	let url = devtools.connect_device_to(target).await.expect("the device dials");

	assert_eq!(url, "ws://100.64.0.5:8097");
	assert_eq!(
		code.await.expect("eval received"),
		bridge::connect_script(Some("100.64.0.5"), port)
	);
	assert!(matches!(devtools.status().bridge, BridgeState::DeviceConnected));
}

#[tokio::test(flavor = "multi_thread")]
async fn connect_device_to_reports_an_unresolvable_host() {
	let (devtools, _) = session();
	let target = ConnectTarget {
		bridge: "no-such-host.invalid:9090".parse().expect("valid shape"),
		advertise_host: None,
	};

	let failure = devtools.connect_device_to(target).await.expect_err("unresolvable");
	assert!(failure.to_string().contains("no-such-host.invalid"), "{failure}");
	assert!(matches!(devtools.status().bridge, BridgeState::Unreachable));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_saved_preset_connects_and_becomes_the_default() {
	let (bridge_addr, code) = fake_bridge("ws://10.0.0.7:8097").await;
	let (devtools, port) = session();
	let name = format!("VM {port}");
	let preset = DevicePreset::parse(&name, &bridge_addr.to_string(), "").expect("valid");
	let revision = devtools.presets_revision();

	devtools.save_preset(preset.clone()).expect("saved");
	assert!(devtools.presets_revision() > revision);
	assert!(devtools.save_preset(preset).is_err(), "a duplicate is rejected");

	let url = devtools
		.connect_preset(&name.to_uppercase())
		.await
		.expect("the device dials");
	assert_eq!(url, "ws://10.0.0.7:8097");
	assert_eq!(code.await.expect("eval received"), bridge::connect_script(None, port));

	let file = PresetFile::locate().expect("located");
	assert!(file.path().starts_with(config_dir()));
	let on_disk = file.load().expect("loaded");
	assert_eq!(on_disk.last_used.as_deref(), Some(name.as_str()));

	devtools.remove_preset(&name).expect("removed");
	assert!(devtools.presets().expect("loaded").get(&name).is_none());
	assert!(devtools.connect_preset(&name).await.is_err());
}
