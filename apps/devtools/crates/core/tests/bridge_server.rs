//! Conformance: this app's bridge and `@unbound-app/debugger`'s bridge go through the same
//! exchanges and must send the same frames, so either can serve the other's tools.

use std::net::SocketAddr;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::{Value as Json, json};
use tokio::net::{TcpListener, TcpStream};
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};
use unbound_devtools_core::bridge_server;

const NO_DEVICE: &str = "No device is connected to the debugger.";
const QUIET: Duration = Duration::from_millis(150);

struct TsBridge(Child);

impl Drop for TsBridge {
	fn drop(&mut self) {
		let _ = self.0.kill();
		let _ = self.0.wait();
	}
}

/// Each bridge under test: this app's, served in-process, and the TS one when Bun can run it.
async fn bridges() -> Vec<(&'static str, SocketAddr, Option<TsBridge>)> {
	let listener = TcpListener::bind("127.0.0.1:0").await.expect("a free port");
	let rust = listener.local_addr().expect("addr");

	tokio::spawn(bridge_server::serve(listener, None));

	let mut bridges = vec![("rust", rust, None)];
	let port = std::net::TcpListener::bind("127.0.0.1:0")
		.and_then(|listener| listener.local_addr())
		.expect("a free port")
		.port();
	let entry = concat!(
		env!("CARGO_MANIFEST_DIR"),
		"/../../../../packages/debugger/src/index.ts"
	);
	let child = Command::new("bun")
		.args([entry, "--port", &port.to_string(), "--idle-timeout", "0"])
		.stdin(Stdio::null())
		.stdout(Stdio::null())
		.stderr(Stdio::null())
		.spawn();

	match child {
		Ok(child) => {
			let address = SocketAddr::from(([127, 0, 0, 1], port));
			let bridge = TsBridge(child);

			for _ in 0..500 {
				if TcpStream::connect(address).await.is_ok() {
					bridges.push(("ts", address, Some(bridge)));
					break;
				}
				tokio::time::sleep(Duration::from_millis(20)).await;
			}
		}
		Err(error) => eprintln!("skipping the TS bridge: cannot run `bun` ({error})"),
	}

	bridges
}

struct Peer {
	socket: WebSocketStream<MaybeTlsStream<TcpStream>>,
	name: &'static str,
}

impl Peer {
	async fn device(bridge: SocketAddr, name: &'static str) -> Self {
		Self::dial(format!("ws://{bridge}/"), name).await
	}

	async fn controller(bridge: SocketAddr, name: &'static str) -> Self {
		Self::dial(format!("ws://{bridge}/?mcp"), name).await
	}

	async fn dial(url: String, name: &'static str) -> Self {
		let (socket, _) = connect_async(url).await.expect("the bridge accepts");
		Self { socket, name }
	}

	async fn send(&mut self, frame: &Json) {
		self.socket
			.send(Message::text(frame.to_string()))
			.await
			.expect("send");
	}

	async fn next(&mut self) -> Json {
		loop {
			let message = tokio::time::timeout(Duration::from_secs(3), self.socket.next())
				.await
				.unwrap_or_else(|_| panic!("{} got nothing", self.name));

			if let Some(Ok(Message::Text(text))) = message {
				return serde_json::from_str(&text).expect("JSON");
			}

			assert!(
				matches!(message, Some(Ok(_))),
				"{} closed: {message:?}",
				self.name
			);
		}
	}

	async fn quiet(&mut self) {
		if let Ok(Some(Ok(Message::Text(text)))) =
			tokio::time::timeout(QUIET, self.socket.next()).await
		{
			panic!("{} got an unexpected frame: {text}", self.name);
		}
	}

	/// Whether the bridge closed this socket.
	async fn closed(&mut self) -> bool {
		loop {
			match tokio::time::timeout(Duration::from_secs(3), self.socket.next()).await {
				Ok(Some(Ok(Message::Close(_)) | Err(_)) | None) => return true,
				Ok(Some(Ok(_))) => {}
				Err(_) => return false,
			}
		}
	}
}

fn contract() -> Json {
	let path = concat!(
		env!("CARGO_MANIFEST_DIR"),
		"/../../../../packages/debugger-protocol/tests/fixtures/devtools-contract.json"
	);

	serde_json::from_str(&std::fs::read_to_string(path).expect("fixture")).expect("JSON")
}

fn hello() -> Json {
	json!({ "type": "hello", "device": contract()["frames"]["deviceConnected"]["device"] })
}

#[tokio::test(flavor = "multi_thread")]
async fn answers_for_a_missing_device() {
	for (name, bridge, _ts) in bridges().await {
		let mut controller = Peer::controller(bridge, name).await;

		assert_eq!(
			controller.next().await,
			json!({ "type": "device-status", "connected": false }),
			"{name}"
		);

		controller
			.send(&json!({ "type": "eval", "id": "e1", "code": "1" }))
			.await;
		assert_eq!(
			controller.next().await,
			json!({ "type": "eval-result", "id": "e1", "ok": false, "error": NO_DEVICE, "code": "no-device" }),
			"{name}"
		);

		controller.send(&contract()["frames"]["viewsRequest"]).await;
		assert_eq!(
			controller.next().await,
			json!({ "type": "views-result", "id": "views-1", "ok": false, "error": NO_DEVICE }),
			"{name}"
		);

		controller
			.send(&contract()["frames"]["metroLoadRequest"])
			.await;
		let failed = controller.next().await;
		assert_eq!(failed["type"], "metro-load-result", "{name}");
		assert_eq!(failed["code"], "failed", "{name}");
		assert_eq!(failed["error"], NO_DEVICE, "{name}");
	}
}

#[tokio::test(flavor = "multi_thread")]
async fn relays_requests_and_answers_to_the_asker() {
	let frames = contract()["frames"].clone();
	let pairs = [
		("viewsRequest", "viewsPage"),
		("viewDetailsRequest", "viewDetailsOk"),
		("explorerObjectRequest", "explorerObjectOk"),
		("metroModulesRequest", "metroModulesOk"),
		("metroReadRequest", "metroReadOk"),
	];

	for (name, bridge, _ts) in bridges().await {
		let mut device = Peer::device(bridge, name).await;
		let mut asker = Peer::controller(bridge, name).await;
		let mut other = Peer::controller(bridge, name).await;

		assert_eq!(
			asker.next().await,
			json!({ "type": "device-status", "connected": true }),
			"{name}"
		);
		other.next().await;

		device.send(&hello()).await;
		let status = asker.next().await;
		assert_eq!(status["device"], hello()["device"], "{name}");
		other.next().await;

		for (request, answer) in pairs {
			let mut answer = frames[answer].clone();
			answer["id"] = frames[request]["id"].clone();

			asker.send(&frames[request]).await;
			assert_eq!(
				device.next().await,
				frames[request],
				"{name} forwards {request}"
			);
			device.send(&answer).await;
			assert_eq!(asker.next().await, answer, "{name} answers {request}");
		}

		asker
			.send(&json!({ "type": "eval", "id": "e1", "code": "1 + 1", "timeout": 5000 }))
			.await;
		assert_eq!(
			device.next().await,
			json!({ "type": "eval", "id": "e1", "code": "1 + 1" }),
			"{name} drops the timeout"
		);
		// An answer of the wrong type does not settle the request.
		device
			.send(
				&json!({ "type": "views-result", "id": "e1", "ok": true, "nodes": [], "total": 0 }),
			)
			.await;
		device
			.send(&json!({ "type": "eval-result", "id": "e1", "ok": true, "value": "2" }))
			.await;
		assert_eq!(
			asker.next().await,
			json!({ "type": "eval-result", "id": "e1", "ok": true, "value": "2" }),
			"{name}"
		);

		let log = json!({ "type": "log", "level": 2, "message": "hi" });
		device.send(&log).await;
		assert_eq!(asker.next().await, log, "{name}");
		assert_eq!(other.next().await, log, "{name}");

		// A malformed source is dropped; a line with its source, scope and time goes through whole.
		device
			.send(&json!({ "type": "log", "level": 1, "message": "x", "source": "kernel" }))
			.await;
		let sourced = json!({
			"type": "log",
			"level": 1,
			"message": "Theme updated.",
			"source": "unbound",
			"scope": ["Loader", "themes"],
			"at": 1_700_000_000_000u64
		});
		device.send(&sourced).await;
		assert_eq!(asker.next().await, sourced, "{name}");
		assert_eq!(other.next().await, sourced, "{name}");
		other.quiet().await;
	}
}

#[tokio::test(flavor = "multi_thread")]
async fn fails_requests_when_the_device_leaves_or_times_out() {
	for (name, bridge, _ts) in bridges().await {
		let mut device = Peer::device(bridge, name).await;
		let mut controller = Peer::controller(bridge, name).await;

		controller.next().await;
		controller
			.send(&json!({ "type": "eval", "id": "slow", "code": "x", "timeout": 100 }))
			.await;
		device.next().await;
		assert_eq!(
			controller.next().await,
			json!({ "type": "eval-result", "id": "slow", "ok": false, "error": "Evaluation timed out after 100ms. Discord is in the foreground, so its JS thread is busy or hung.", "code": "timeout" }),
			"{name}"
		);

		controller
			.send(&json!({ "type": "eval", "id": "left", "code": "x" }))
			.await;
		device.next().await;
		drop(device);
		assert_eq!(
			controller.next().await,
			json!({ "type": "eval-result", "id": "left", "ok": false, "error": "Device disconnected before the evaluation completed.", "code": "device-disconnected" }),
			"{name}"
		);
		assert_eq!(
			controller.next().await,
			json!({ "type": "device-status", "connected": false }),
			"{name}"
		);
	}
}

#[tokio::test(flavor = "multi_thread")]
async fn tells_a_suspended_or_backgrounded_app_from_a_hung_one() {
	for (name, bridge, _ts) in bridges().await {
		let mut device = Peer::device(bridge, name).await;
		let mut controller = Peer::controller(bridge, name).await;

		controller.next().await;
		device
			.send(&json!({ "type": "app-state", "state": "inactive" }))
			.await;
		controller
			.send(&json!({ "type": "eval", "id": "paused", "code": "x", "timeout": 100 }))
			.await;
		device.next().await;
		assert_eq!(
			controller.next().await,
			json!({ "type": "eval-result", "id": "paused", "ok": false, "error": "Evaluation timed out after 100ms. Discord is not in the foreground, so iOS may have suspended it; open Discord and retry.", "code": "timeout" }),
			"{name}"
		);

		device
			.send(&json!({ "type": "app-state", "state": "background" }))
			.await;
		// The app-state frame reaches the bridge before the close does.
		tokio::time::sleep(Duration::from_millis(50)).await;
		drop(device);
		assert_eq!(
			controller.next().await,
			json!({ "type": "device-status", "connected": false, "inBackground": true }),
			"{name}"
		);
		controller
			.send(&json!({ "type": "eval", "id": "gone", "code": "x" }))
			.await;
		assert_eq!(
			controller.next().await,
			json!({ "type": "eval-result", "id": "gone", "ok": false, "error": "No device is connected to the debugger. Discord went to the background, which closes its debugger; open Discord to reconnect.", "code": "no-device" }),
			"{name}"
		);
	}
}

#[tokio::test(flavor = "multi_thread")]
async fn routes_react_devtools_to_the_frontend_and_replaces_a_device() {
	for (name, bridge, _ts) in bridges().await {
		let mut first = Peer::device(bridge, name).await;
		let mut frontend = Peer::controller(bridge, name).await;
		let mut other = Peer::controller(bridge, name).await;

		frontend.next().await;
		other.next().await;

		let frame =
			json!({ "type": "react-devtools", "event": "inspectElement", "payload": { "id": 1 } });
		frontend.send(&frame).await;
		assert_eq!(first.next().await, frame, "{name}");
		first.send(&frame).await;
		assert_eq!(frontend.next().await, frame, "{name}");
		other.quiet().await;

		drop(frontend);
		assert_eq!(
			first.next().await,
			json!({ "type": "react-devtools", "event": "shutdown" }),
			"{name} ends the session"
		);

		let _second = Peer::device(bridge, name).await;
		assert!(first.closed().await, "{name} closes the replaced device");
		assert_eq!(
			other.next().await,
			json!({ "type": "device-status", "connected": false }),
			"{name}"
		);
		assert_eq!(
			other.next().await,
			json!({ "type": "device-status", "connected": true }),
			"{name}"
		);
	}
}

#[tokio::test(flavor = "multi_thread")]
async fn exits_once_no_controller_is_attached() {
	let listener = TcpListener::bind("127.0.0.1:0").await.expect("a free port");
	let bridge = listener.local_addr().expect("addr");
	let served = tokio::spawn(bridge_server::serve(
		listener,
		Some(Duration::from_millis(200)),
	));
	let controller = Peer::controller(bridge, "rust").await;

	tokio::time::sleep(Duration::from_millis(400)).await;
	assert!(
		!served.is_finished(),
		"stays up while a controller is attached"
	);

	drop(controller);
	tokio::time::timeout(Duration::from_secs(2), served)
		.await
		.expect("exits after the idle timeout")
		.expect("serve ends cleanly");
}

/// The served bridge advertises `_unbound-bridge._tcp` with the code it tells controllers, and
/// withdraws it when it idles out, so a phone's prompt goes away.
#[tokio::test(flavor = "multi_thread")]
async fn advertises_over_bonjour_until_it_exits() {
	use mdns_sd::{ServiceDaemon, ServiceEvent};

	const SERVICE: &str = "_unbound-bridge._tcp.local.";

	// GitHub's macOS runners never deliver the multicast answer back to a browser on the same host,
	// so the lookup always times out there; the Linux and Windows runs still prove it.
	if cfg!(target_os = "macos") && std::env::var_os("GITHUB_ACTIONS").is_some() {
		eprintln!("skipping: GitHub's macOS runners drop looped-back mDNS");
		return;
	}

	let port = std::net::TcpListener::bind("127.0.0.1:0")
		.and_then(|listener| listener.local_addr())
		.expect("a free port")
		.port();
	let browser = ServiceDaemon::new().expect("an mDNS browser");
	let events = browser.browse(SERVICE).expect("browse");
	let served = tokio::spawn(bridge_server::run(port, Some(Duration::from_secs(1))));
	let mut controller = Peer::controller(SocketAddr::from(([127, 0, 0, 1], port)), "rust").await;

	assert_eq!(controller.next().await["type"], "device-status");

	let info = controller.next().await;

	assert_eq!(info["type"], "bridge-info");

	if info["advertising"] != true {
		eprintln!(
			"skipping: this machine cannot advertise ({})",
			info["error"]
		);
		return;
	}

	let code = info["code"].as_str().expect("a code").to_owned();
	let resolved = tokio::time::timeout(Duration::from_secs(5), async {
		loop {
			if let Ok(ServiceEvent::ServiceResolved(service)) = events.recv_async().await
				&& service.get_port() == port
			{
				return service;
			}
		}
	})
	.await
	.expect("the bridge is advertised");

	assert_eq!(resolved.get_property_val_str("proto"), Some("1"));
	assert_eq!(resolved.get_property_val_str("by"), Some("devtools"));
	assert_eq!(resolved.get_property_val_str("code"), Some(code.as_str()));

	let fullname = resolved.get_fullname().to_owned();

	drop(controller);
	tokio::time::timeout(Duration::from_secs(5), served)
		.await
		.expect("the bridge idles out")
		.expect("the bridge task")
		.expect("the bridge ran");

	let removed = tokio::time::timeout(Duration::from_secs(5), async {
		loop {
			if let Ok(ServiceEvent::ServiceRemoved(_, name)) = events.recv_async().await
				&& name == fullname
			{
				return;
			}
		}
	})
	.await;

	assert!(removed.is_ok(), "the advertisement is withdrawn");
	let _ = browser.shutdown();
}

/// The next control frame the device gets, skipping text.
async fn next_pong(device: &mut Peer) -> bool {
	let wait = async {
		while let Some(Ok(message)) = device.socket.next().await {
			if message.is_pong() {
				return true;
			}
		}
		false
	};

	tokio::time::timeout(QUIET, wait).await.unwrap_or(false)
}

#[tokio::test(flavor = "multi_thread")]
async fn acknowledges_device_frames_at_once_while_a_request_is_out() {
	let listener = TcpListener::bind("127.0.0.1:0").await.expect("a free port");
	let bridge = listener.local_addr().expect("addr");
	tokio::spawn(bridge_server::serve(listener, None));
	let mut device = Peer::device(bridge, "rust").await;
	let mut controller = Peer::controller(bridge, "rust").await;
	let log = json!({ "type": "log", "level": 1, "message": "noise" });

	controller.next().await;
	device.send(&log).await;
	assert!(!next_pong(&mut device).await, "no request is out");

	controller
		.send(&json!({ "type": "eval", "id": "e1", "code": "1" }))
		.await;
	assert_eq!(device.next().await["type"], "eval");
	device.send(&log).await;
	assert!(next_pong(&mut device).await, "the log is acknowledged");
}
