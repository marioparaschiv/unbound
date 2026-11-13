use std::net::SocketAddr;
use std::sync::OnceLock;

use futures_util::{SinkExt, StreamExt};
use serde_json::{Value as Json, json};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio_tungstenite::tungstenite::Message;
use unbound_devtools_core::presets::CONFIG_DIR_ENV;
use unbound_devtools_core::{BridgeState, Config, Devtools};

async fn fake_bridge(
	device_connected: bool,
	reply: Json,
) -> (SocketAddr, oneshot::Receiver<String>) {
	let listener = TcpListener::bind("127.0.0.1:0")
		.await
		.expect("bridge binds");
	let addr = listener.local_addr().expect("bridge addr");
	let (code_tx, code_rx) = oneshot::channel();

	tokio::spawn(async move {
		let (stream, _) = listener.accept().await.expect("controller dials");
		let mut socket = tokio_tungstenite::accept_async(stream)
			.await
			.expect("handshake");
		let status = json!({ "type": "device-status", "connected": device_connected });
		socket
			.send(Message::text(status.to_string()))
			.await
			.expect("status sends");

		while let Some(Ok(Message::Text(text))) = socket.next().await {
			let request: Json = serde_json::from_str(&text).expect("JSON request");

			if request["type"] != "eval" {
				continue;
			}

			let log = json!({ "type": "log", "level": 1, "message": "noise" });
			socket
				.send(Message::text(log.to_string()))
				.await
				.expect("log sends");
			let mut result = reply.clone();
			result["type"] = json!("eval-result");
			result["id"] = request["id"].clone();
			socket
				.send(Message::text(result.to_string()))
				.await
				.expect("result sends");
			let _ = code_tx.send(request["code"].as_str().unwrap_or_default().to_owned());
			break;
		}
	});

	(addr, code_rx)
}

/// Keeps any saved state here, not in the user's config.
fn config_dir() {
	static DIR: OnceLock<()> = OnceLock::new();
	DIR.get_or_init(|| {
		let dir =
			std::env::temp_dir().join(format!("unbound-devtools-bridge-{}", std::process::id()));
		// SAFETY: set once, before any test reads it, under the OnceLock.
		unsafe { std::env::set_var(CONFIG_DIR_ENV, dir) };
	});
}

fn session_with_bridge(bridge: SocketAddr) -> Devtools {
	config_dir();
	Devtools::start(Config {
		bridge,
		bridge_launcher: None,
	})
}

#[tokio::test(flavor = "multi_thread")]
async fn eval_runs_on_the_device_over_the_bridge() {
	let (bridge_addr, code) = fake_bridge(true, json!({ "ok": true, "value": "42" })).await;
	let devtools = session_with_bridge(bridge_addr);

	let value = devtools.eval("6 * 7").await.expect("the device answers");

	assert_eq!(value, "42");
	assert_eq!(code.await.expect("eval received"), "6 * 7");
	assert!(matches!(
		devtools.status().bridge,
		BridgeState::DeviceConnected
	));
}

#[tokio::test(flavor = "multi_thread")]
async fn eval_reports_the_device_error() {
	let error = "ReferenceError: nope is not defined";
	let (bridge_addr, _) = fake_bridge(true, json!({ "ok": false, "error": error })).await;
	let devtools = session_with_bridge(bridge_addr);

	let failure = devtools.eval("nope").await.expect_err("the eval threw");
	assert_eq!(failure.to_string(), error);
}

#[tokio::test(flavor = "multi_thread")]
async fn eval_without_a_device_or_bridge() {
	let (bridge_addr, _) = fake_bridge(false, json!({})).await;
	let devtools = session_with_bridge(bridge_addr);
	let failure = devtools.eval("1").await.expect_err("no device");
	assert!(failure.to_string().contains("No device"), "{failure}");
	assert!(matches!(devtools.status().bridge, BridgeState::NoDevice));

	let devtools = session_with_bridge("127.0.0.1:9".parse().expect("addr"));
	let failure = devtools.eval("1").await.expect_err("no bridge");
	assert!(failure.to_string().contains("unreachable"), "{failure}");
	assert!(matches!(devtools.status().bridge, BridgeState::Unreachable));
}
