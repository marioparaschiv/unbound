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
	BridgeState, Config, ConnectTarget, ConnectionState, Devtools, LinkStatus, PropertyKind,
	PropertyValue,
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

/// Accepts controllers forever: announces a device, reports each frame a controller sends, and
/// answers every `react-devtools` frame with `reply`, every `views-request` with one view of a level of
/// three, and every `view-details-request` with one section.
async fn fake_bridge(reply: Json) -> (SocketAddr, mpsc::UnboundedReceiver<Json>) {
	let listener = TcpListener::bind("127.0.0.1:0")
		.await
		.expect("bridge binds");
	let addr = listener.local_addr().expect("bridge addr");
	let (frame_tx, frame_rx) = mpsc::unbounded_channel();

	tokio::spawn(async move {
		while let Ok((stream, _)) = listener.accept().await {
			let reply = reply.clone();
			let frame_tx = frame_tx.clone();
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
					let frame: Json = serde_json::from_str(&text).expect("JSON frame");
					let answer = match frame["type"].as_str() {
						Some("react-devtools") => Some(reply.clone()),
						Some("views-request") => Some(json!({
							"type": "views-result",
							"id": frame["id"],
							"ok": true,
							"nodes": [{
								"id": "0",
								"className": "com.discord.MainActivity$Root",
								"resourceName": "content",
								"frame": { "x": 0, "y": 0, "width": 411, "height": 914 },
								"visibility": "visible",
								"alpha": 1,
								"text": null,
								"childCount": 1,
							}],
							"total": 3,
						})),
						Some("view-details-request") => Some(json!({
							"type": "view-details-result",
							"id": frame["id"],
							"ok": true,
							"details": {
								"classChain": ["com.discord.MainActivity$Root", "android.view.View"],
								"sections": [{
									"title": "Drawing",
									"properties": [
										{ "key": "background", "value": "#313338FF", "kind": "color" },
										{ "key": "elevation", "value": 1.5, "unit": "dp" },
										{ "key": "opaque", "value": false },
										{ "key": "foreground", "value": null },
									],
								}],
							},
						})),
						_ => None,
					};
					if let Some(answer) = answer {
						let _ = socket.send(Message::text(answer.to_string())).await;
					}
					let _ = frame_tx.send(frame);
				}
			});
		}
	});

	(addr, frame_rx)
}

fn session() -> Devtools {
	config_dir();
	Devtools::start(Config {
		bridge: "127.0.0.1:9".parse().expect("addr"),
		bridge_launcher: None,
	})
}

fn link(devtools: &Devtools, bridge: SocketAddr) {
	devtools.link_to(
		ConnectTarget {
			bridge: bridge.into(),
		},
		None,
	);
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

/// Waits up to 5 s for the React DevTools connection to satisfy `done`.
async fn connection_until(devtools: &Devtools, done: impl Fn(&ConnectionState) -> bool) {
	let mut changes = devtools.changes();
	let wait = async {
		while !done(&devtools.status().connection) {
			changes.changed().await.expect("devtools alive");
		}
	};

	tokio::time::timeout(Duration::from_secs(5), wait)
		.await
		.unwrap_or_else(|_| panic!("never settled: {:?}", devtools.status().connection));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_link_starts_react_devtools_on_the_attached_device() {
	let version =
		json!({ "type": "react-devtools", "event": "backendVersion", "payload": "8.0.0" });
	let (bridge_addr, mut frames) = fake_bridge(version).await;
	let devtools = session();

	link(&devtools, bridge_addr);

	let first = tokio::time::timeout(Duration::from_secs(5), frames.recv())
		.await
		.expect("the link sends a frame")
		.expect("a frame");
	assert_eq!(
		first,
		json!({ "type": "react-devtools", "event": "getBridgeProtocol" })
	);
	let status = link_until(&devtools, |link| {
		matches!(link.state, BridgeState::DeviceConnected) && link.device.is_some()
	})
	.await;
	assert_eq!(status.device.expect("device").discord_version, "300.0");
	connection_until(&devtools, |connection| {
		matches!(
			connection,
			ConnectionState::Connected {
				backend_version: Some(version),
				..
			} if version == "8.0.0"
		)
	})
	.await;

	devtools.unlink();
	assert!(matches!(
		devtools.status().connection,
		ConnectionState::Waiting
	));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_device_without_react_devtools_says_why() {
	let status = json!({
		"type": "react-devtools",
		"event": "unbound:backend-status",
		"payload": { "connected": false, "error": "React DevTools is not loaded" },
	});
	let (bridge_addr, _frames) = fake_bridge(status).await;
	let devtools = session();

	link(&devtools, bridge_addr);

	connection_until(&devtools, |connection| {
		matches!(
			connection,
			ConnectionState::Unavailable { error } if error == "React DevTools is not loaded"
		)
	})
	.await;
}

#[tokio::test(flavor = "multi_thread")]
async fn a_link_lists_and_highlights_native_views() {
	let (bridge_addr, mut frames) = fake_bridge(json!({})).await;
	let devtools = session();

	assert!(devtools.list_views(None, 0).await.is_err(), "no link yet");
	link(&devtools, bridge_addr);
	link_until(&devtools, |link| {
		matches!(link.state, BridgeState::DeviceConnected)
	})
	.await;

	let page = devtools
		.list_views(Some("7".into()), 100)
		.await
		.expect("the device lists");
	assert_eq!(page.total, Some(3));
	assert_eq!(page.nodes.len(), 1);
	assert_eq!(page.nodes[0].short_name(), "Root");
	assert_eq!(page.nodes[0].resource_name.as_deref(), Some("content"));
	let request = async {
		loop {
			let frame = frames.recv().await.expect("a frame");
			if frame["type"] == "views-request" {
				return frame;
			}
		}
	};
	let request = tokio::time::timeout(Duration::from_secs(5), request)
		.await
		.expect("the request arrives");
	assert_eq!(
		(&request["parent"], &request["offset"], &request["limit"]),
		(&json!("7"), &json!(100), &json!(100))
	);

	let details = devtools
		.view_details("0")
		.await
		.expect("the device reads the view");
	assert_eq!(details.class_chain[1], "android.view.View");
	let properties = &details.sections[0].properties;
	assert_eq!(properties[0].kind, Some(PropertyKind::Color));
	assert_eq!(properties[1].value, PropertyValue::Number(1.5));
	assert_eq!(properties[1].unit.as_deref(), Some("dp"));
	assert_eq!(properties[2].value, PropertyValue::Bool(false));
	assert_eq!(properties[3].value, PropertyValue::Null);

	devtools.highlight_view(Some("0"));
	let highlight = async {
		loop {
			let frame = frames.recv().await.expect("a frame");
			if frame["type"] == "view-highlight" {
				return frame;
			}
		}
	};
	let highlight = tokio::time::timeout(Duration::from_secs(5), highlight)
		.await
		.expect("the highlight arrives");
	assert_eq!(highlight, json!({ "type": "view-highlight", "node": "0" }));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_link_to_a_dead_bridge_retries() {
	let devtools = session();

	devtools.link_to(
		ConnectTarget {
			bridge: "127.0.0.1:9".parse().expect("addr"),
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
	let devtools = session();

	devtools.connect_link(None).expect("linked");
	drop(devtools);

	let devtools = session();
	devtools.resume_link();
	assert!(devtools.status().link.is_some(), "restored");

	devtools.disconnect_link();
	drop(devtools);

	let devtools = session();
	devtools.resume_link();
	assert!(devtools.status().link.is_none(), "stays off");
}
