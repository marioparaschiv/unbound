//! `connect_device` against an in-test debugger bridge, and the device-side connect script run
//! under bun with a stubbed `DevTools` and `unbound.storage`.

use std::net::SocketAddr;
use std::process::Command;

use futures_util::{SinkExt, StreamExt};
use serde_json::{Value as Json, json};
use tokio::net::TcpListener;
use tokio::sync::oneshot;
use tokio_tungstenite::tungstenite::Message;
use unbound_devtools_core::{BridgeState, Config, ConnectionState, Devtools, bridge};

/// Accepts one controller, announces `device_connected`, answers its eval with `reply` and hands
/// the eval's code back to the test.
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

fn session_with_bridge(bridge: SocketAddr) -> (Devtools, u16) {
	let devtools = Devtools::start(Config {
		listen: "127.0.0.1:0".parse().expect("addr"),
		bridge,
		advertise_host: None,
	});
	let ConnectionState::Listening { addr } = devtools.status().connection else {
		panic!("listening");
	};

	(devtools, addr.port())
}

#[tokio::test(flavor = "multi_thread")]
async fn connect_device_evaluates_the_connect_script_over_the_bridge() {
	let (bridge_addr, code) =
		fake_bridge(true, json!({ "ok": true, "value": "ws://10.0.0.5:8097" })).await;
	let (devtools, port) = session_with_bridge(bridge_addr);

	let url = devtools.connect_device().await.expect("the device dials");

	assert_eq!(url, "ws://10.0.0.5:8097");
	assert_eq!(
		code.await.expect("eval received"),
		bridge::connect_script(None, port)
	);
	assert!(matches!(
		devtools.status().bridge,
		BridgeState::DeviceConnected
	));
}

#[tokio::test(flavor = "multi_thread")]
async fn connect_device_reports_the_device_error() {
	let error = "Error: React DevTools is not loaded on this device.";
	let (bridge_addr, _) = fake_bridge(true, json!({ "ok": false, "error": error })).await;
	let (devtools, _) = session_with_bridge(bridge_addr);

	let failure = devtools.connect_device().await.expect_err("the eval threw");
	assert_eq!(failure.to_string(), error);
}

#[tokio::test(flavor = "multi_thread")]
async fn connect_device_without_a_device_or_bridge() {
	let (bridge_addr, _) = fake_bridge(false, json!({})).await;
	let (devtools, _) = session_with_bridge(bridge_addr);
	let failure = devtools.connect_device().await.expect_err("no device");
	assert!(failure.to_string().contains("No device"), "{failure}");
	assert!(matches!(devtools.status().bridge, BridgeState::NoDevice));

	let (devtools, _) = session_with_bridge("127.0.0.1:9".parse().expect("addr"));
	let failure = devtools.connect_device().await.expect_err("no bridge");
	assert!(failure.to_string().contains("unreachable"), "{failure}");
	assert!(matches!(devtools.status().bridge, BridgeState::Unreachable));
}

/// Runs `script` twice under bun with stubbed device globals; `None` without bun.
fn run_on_fake_device(script: &str, devtools_loaded: bool, address: &str) -> Option<Json> {
	let harness = format!(
		r#"
		const calls = [];
		if ({devtools_loaded}) globalThis.DevTools = {{ connect: (options) => calls.push(options) }};
		globalThis.unbound = {{ storage: {{ get: (store, key, fallback) =>
			store === 'unbound' && key === 'debugger.address' ? {address} : fallback }} }};
		const run = () => {{ try {{ return {{ ok: {script} }}; }} catch (e) {{ return {{ error: e.message }}; }} }};
		console.log(JSON.stringify({{ first: run(), second: run(), calls }}));
		"#,
		address = Json::from(address),
	);
	let output = Command::new("bun").arg("-e").arg(harness).output();
	let Ok(output) = output else {
		eprintln!("skipping: cannot run `bun`");
		return None;
	};

	assert!(
		output.status.success(),
		"{}",
		String::from_utf8_lossy(&output.stderr)
	);
	Some(serde_json::from_slice(&output.stdout).expect("JSON output"))
}

#[test]
fn the_connect_script_dials_the_debugger_host_once() {
	let Some(out) = run_on_fake_device(
		&bridge::connect_script(None, 8097),
		true,
		"192.168.1.5:9090",
	) else {
		return;
	};

	assert_eq!(out["first"], json!({ "ok": "ws://192.168.1.5:8097" }));
	assert_eq!(out["second"], json!({ "ok": "ws://192.168.1.5:8097" }));
	assert_eq!(
		out["calls"],
		json!([{ "host": "192.168.1.5", "port": 8097 }])
	);

	let Some(out) = run_on_fake_device(&bridge::connect_script(Some("fd7a::1"), 1234), true, "")
	else {
		return;
	};
	assert_eq!(out["first"], json!({ "ok": "ws://[fd7a::1]:1234" }));

	let Some(out) = run_on_fake_device(&bridge::connect_script(None, 8097), true, "") else {
		return;
	};
	assert!(
		out["first"]["error"]
			.as_str()
			.is_some_and(|e| e.contains("debugger.address")),
		"{out}"
	);

	let Some(out) = run_on_fake_device(&bridge::connect_script(None, 8097), false, "h:1") else {
		return;
	};
	assert!(
		out["first"]["error"]
			.as_str()
			.is_some_and(|e| e.contains("Enable loader.devtools")),
		"{out}"
	);
}
