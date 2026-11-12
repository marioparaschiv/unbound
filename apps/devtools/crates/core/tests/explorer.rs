//! The native object explorer's requests against a fake bridge that answers them like a device.

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
	BridgeState, Config, ConnectTarget, Devtools, ExplorerError, ExplorerErrorCode,
	ExplorerMemberKind, ExplorerPlatform, ExplorerRead, ExplorerTarget, ExplorerValueKind,
};

fn config_dir() {
	static DIR: OnceLock<()> = OnceLock::new();
	DIR.get_or_init(|| {
		let dir =
			std::env::temp_dir().join(format!("unbound-devtools-explorer-{}", std::process::id()));
		let _ = std::fs::remove_dir_all(&dir);
		// SAFETY: set once, before any test reads it, under the OnceLock.
		unsafe { std::env::set_var(CONFIG_DIR_ENV, dir) };
	});
}

/// The device's answer to one explorer request: `{ object: "gone" }` is stale after a reload.
fn answer(frame: &Json) -> Option<Json> {
	let id = frame["id"].clone();
	let answer = match frame["type"].as_str()? {
		"explorer-object-request" if frame["target"]["object"] == "gone" => json!({
			"type": "explorer-object-result", "id": id, "ok": false,
			"error": "Object gone after reload.", "code": "stale",
		}),
		"explorer-object-request" => json!({
			"type": "explorer-object-result", "id": id, "ok": true,
			"object": {
				"ref": "e1:4", "className": "UILabel", "description": "<UILabel: 0x1>", "platform": "ios",
				"chain": [
					{ "name": "UILabel", "image": "UIKitCore", "instanceSize": 712,
					  "counts": { "properties": 40, "ivars": 12, "methods": 300 } },
					{ "name": "UIView", "image": "UIKitCore", "instanceSize": 488, "counts": {} },
				],
			},
		}),
		"explorer-members-request" => json!({
			"type": "explorer-members-result", "id": id, "ok": true, "total": 300,
			"members": [{
				"name": "setText:", "kind": "methods", "type": "void",
				"signature": "- (void)setText:(NSString *)text", "returnType": "void",
				"parameters": ["NSString *"], "read": "never",
			}],
		}),
		"explorer-values-request" => json!({
			"type": "explorer-values-result", "id": id, "ok": true,
			"values": [
				{ "name": "_textColor", "kind": "object", "text": "<UIColor>", "object": "e1:5", "className": "UIColor" },
				{ "name": "_size", "kind": "struct", "text": "{1, 2}" },
			],
		}),
		"explorer-classes-request" if frame.get("image").is_some() => json!({
			"type": "explorer-classes-result", "id": id, "ok": true, "total": 2,
			"classes": ["UILabel", "UIView"],
		}),
		"explorer-classes-request" => json!({
			"type": "explorer-classes-result", "id": id, "ok": false,
			"error": "The inspector is off; turn on developer mode.", "code": "disabled",
		}),
		_ => return None,
	};
	Some(answer)
}

async fn fake_bridge() -> (SocketAddr, mpsc::UnboundedReceiver<Json>) {
	let listener = TcpListener::bind("127.0.0.1:0")
		.await
		.expect("bridge binds");
	let addr = listener.local_addr().expect("bridge addr");
	let (frame_tx, frame_rx) = mpsc::unbounded_channel();

	tokio::spawn(async move {
		while let Ok((stream, _)) = listener.accept().await {
			let frame_tx = frame_tx.clone();
			tokio::spawn(async move {
				let mut socket = tokio_tungstenite::accept_async(stream)
					.await
					.expect("handshake");
				let status = json!({ "type": "device-status", "connected": true });
				socket
					.send(Message::text(status.to_string()))
					.await
					.expect("status sends");

				while let Some(Ok(Message::Text(text))) = socket.next().await {
					let frame: Json = serde_json::from_str(&text).expect("JSON frame");
					if let Some(answer) = answer(&frame) {
						let _ = socket.send(Message::text(answer.to_string())).await;
					}
					let _ = frame_tx.send(frame);
				}
			});
		}
	});

	(addr, frame_rx)
}

async fn linked() -> (Devtools, mpsc::UnboundedReceiver<Json>) {
	config_dir();
	let (bridge, frames) = fake_bridge().await;
	let devtools = Devtools::start(Config {
		bridge: "127.0.0.1:9".parse().expect("addr"),
	});
	devtools.link_to(
		ConnectTarget {
			bridge: bridge.into(),
		},
		None,
	);
	let mut changes = devtools.changes();
	let wait = async {
		while !devtools
			.status()
			.link
			.is_some_and(|link| matches!(link.state, BridgeState::DeviceConnected))
		{
			changes.changed().await.expect("devtools alive");
		}
	};
	tokio::time::timeout(Duration::from_secs(5), wait)
		.await
		.expect("the link attaches");
	(devtools, frames)
}

/// The next frame of `kind` the controller sent.
async fn sent(frames: &mut mpsc::UnboundedReceiver<Json>, kind: &str) -> Json {
	let find = async {
		loop {
			let frame = frames.recv().await.expect("a frame");
			if frame["type"] == kind {
				return frame;
			}
		}
	};
	tokio::time::timeout(Duration::from_secs(5), find)
		.await
		.expect("the request arrives")
}

#[tokio::test(flavor = "multi_thread")]
async fn an_explorer_without_a_link_is_not_connected() {
	config_dir();
	let devtools = Devtools::start(Config {
		bridge: "127.0.0.1:9".parse().expect("addr"),
	});
	let error = devtools
		.explorer_object(&ExplorerTarget::Node("1".into()))
		.await
		.expect_err("no link");
	assert_eq!(error, ExplorerError::NotConnected);
}

#[tokio::test(flavor = "multi_thread")]
async fn the_explorer_opens_an_object_and_reads_its_members() {
	let (devtools, mut frames) = linked().await;

	let object = devtools
		.explorer_object(&ExplorerTarget::Node("4".into()))
		.await
		.expect("the device opens the node");
	assert_eq!(object.object_ref.as_deref(), Some("e1:4"));
	assert_eq!(object.platform, ExplorerPlatform::Ios);
	assert_eq!(object.chain[0].counts[&ExplorerMemberKind::Methods], 300);
	assert_eq!(object.chain[0].instance_size, Some(712));
	assert_eq!(
		sent(&mut frames, "explorer-object-request").await["target"],
		json!({ "node": "4" })
	);

	let page = devtools
		.explorer_members("UILabel", ExplorerMemberKind::Methods, 100, "text")
		.await
		.expect("the device lists members");
	assert_eq!(page.total, 300);
	assert_eq!(
		page.members[0].parameters.as_deref(),
		Some(&["NSString *".to_owned()][..])
	);
	assert_eq!(page.members[0].read, ExplorerRead::Never);
	let request = sent(&mut frames, "explorer-members-request").await;
	assert_eq!(
		(
			&request["kind"],
			&request["offset"],
			&request["limit"],
			&request["filter"]
		),
		(&json!("methods"), &json!(100), &json!(100), &json!("text"))
	);

	let values = devtools
		.explorer_values(
			"e1:4",
			"UILabel",
			ExplorerMemberKind::Ivars,
			&["_textColor".into(), "_size".into()],
			true,
		)
		.await
		.expect("the device reads values");
	assert_eq!(values[0].object.as_deref(), Some("e1:5"));
	assert_eq!(values[1].kind, ExplorerValueKind::Struct);
	assert_eq!(
		sent(&mut frames, "explorer-values-request").await["invokeGetters"],
		true
	);

	let classes = devtools
		.explorer_classes(Some("/System/UIKitCore"), "", 0)
		.await
		.expect("the device lists classes");
	assert_eq!((classes.total, classes.classes.len()), (2, 2));
}

#[tokio::test(flavor = "multi_thread")]
async fn explorer_failures_keep_their_code() {
	let (devtools, _frames) = linked().await;

	let stale = devtools
		.explorer_object(&ExplorerTarget::Object("gone".into()))
		.await
		.expect_err("the ref is stale");
	assert!(stale.is_stale());

	let disabled = devtools
		.explorer_classes(None, "", 0)
		.await
		.expect_err("the inspector is off");
	assert_eq!(disabled.code(), Some(ExplorerErrorCode::Disabled));
	assert!(disabled.to_string().contains("developer mode"));
}
