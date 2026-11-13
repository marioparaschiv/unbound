//! A controller client for the Unbound debugger bridge (`packages/debugger`), mirroring
//! `@unbound-app/debugger-protocol`'s `ControllerClient`: dial `ws://<bridge>/?mcp`, send
//! `{type:"eval", id, code, timeout?}`, match the `eval-result` by id. [`eval`] opens one
//! short-lived socket per call; the debugger connection (`link.rs`) keeps its own open and carries
//! React DevTools and the view finder over it.

use std::net::SocketAddr;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::net::TcpStream;
use tokio::time;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::{MaybeTlsStream, WebSocketStream, connect_async};

use crate::explorer::{
	ExplorerErrorCode, ExplorerImage, ExplorerMember, ExplorerObject, ExplorerValue,
};
use crate::views::{ViewDetails, ViewNode};

pub(crate) type Socket = WebSocketStream<MaybeTlsStream<TcpStream>>;

/// What a device reports about itself once it says hello (`DeviceInfo` in the protocol).
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DeviceInfo {
	pub platform: String,
	pub discord_version: String,
	pub loader_version: String,
	pub client_version: String,
}

#[derive(Debug)]
pub struct EvalOutcome {
	pub ok: bool,
	/// `value` when ok, `error` otherwise.
	pub text: String,
	/// Why the bridge or controller failed the eval (`RequestFailureCode`, such as `timeout`); `None`
	/// when it succeeded or the code itself threw.
	pub code: Option<String>,
	/// Whether the bridge reported a device on attach (`device-status`).
	pub device_connected: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum BridgeError {
	#[error(
		"the Unbound debugger bridge at {addr} is unreachable ({reason}); start it with `ub-debugger`"
	)]
	Unreachable { addr: SocketAddr, reason: String },
	#[error("the bridge closed the connection before answering")]
	Closed,
	#[error("the bridge did not answer within {0} ms")]
	Timeout(u64),
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub(crate) enum BridgeFrame {
	DeviceStatus {
		connected: bool,
		#[serde(default)]
		device: Option<DeviceInfo>,
	},
	EvalResult {
		id: String,
		ok: bool,
		value: Option<String>,
		error: Option<String>,
		#[serde(default)]
		code: Option<String>,
	},
	/// One React DevTools frame; `protocol::parse` reads it from the frame's text.
	ReactDevtools {},
	ViewsResult {
		id: String,
		ok: bool,
		#[serde(default)]
		nodes: Vec<ViewNode>,
		#[serde(default)]
		total: Option<u32>,
		error: Option<String>,
	},
	ViewDetailsResult {
		id: String,
		ok: bool,
		#[serde(default)]
		details: Option<ViewDetails>,
		error: Option<String>,
	},
	ExplorerObjectResult {
		id: String,
		ok: bool,
		#[serde(default)]
		object: Option<ExplorerObject>,
		error: Option<String>,
		code: Option<ExplorerErrorCode>,
	},
	ExplorerMembersResult {
		id: String,
		ok: bool,
		#[serde(default)]
		members: Vec<ExplorerMember>,
		#[serde(default)]
		total: Option<u32>,
		error: Option<String>,
		code: Option<ExplorerErrorCode>,
	},
	ExplorerValuesResult {
		id: String,
		ok: bool,
		#[serde(default)]
		values: Vec<ExplorerValue>,
		error: Option<String>,
		code: Option<ExplorerErrorCode>,
	},
	ExplorerClassesResult {
		id: String,
		ok: bool,
		#[serde(default)]
		total: Option<u32>,
		#[serde(default)]
		images: Option<Vec<ExplorerImage>>,
		#[serde(default)]
		classes: Option<Vec<String>>,
		error: Option<String>,
		code: Option<ExplorerErrorCode>,
	},
	#[serde(other)]
	Other,
}

/// The query marker that makes the bridge route this socket as a controller (`CONTROLLER_ENDPOINT_MARKER`).
const CONTROLLER_ENDPOINT_MARKER: &str = "mcp";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
/// The bridge sends `device-status` right after a controller attaches.
const STATUS_WAIT: Duration = Duration::from_millis(1500);
pub(crate) const REPLY_GRACE_MS: u64 = 2000;

/// Opens a controller socket to the bridge at `bridge`.
pub(crate) async fn dial(bridge: SocketAddr) -> Result<Socket, BridgeError> {
	let unreachable = |reason: String| BridgeError::Unreachable {
		addr: bridge,
		reason,
	};
	let (socket, _) = time::timeout(
		CONNECT_TIMEOUT,
		connect_async(format!("ws://{bridge}/?{CONTROLLER_ENDPOINT_MARKER}")),
	)
	.await
	.map_err(|_| unreachable("timed out".to_owned()))?
	.map_err(|error| unreachable(error.to_string()))?;

	Ok(socket)
}

/// An `eval` request frame; the reply is the `eval-result` with the same `id`.
pub(crate) fn eval_request(id: &str, code: &str, timeout_ms: u64) -> Message {
	Message::text(
		json!({ "type": "eval", "id": id, "code": code, "timeout": timeout_ms }).to_string(),
	)
}

pub async fn eval(bridge: SocketAddr, code: &str, timeout_ms: u64) -> anyhow::Result<EvalOutcome> {
	let mut socket = dial(bridge).await?;

	let device_connected = match time::timeout(STATUS_WAIT, next_frame(&mut socket)).await {
		Ok(Some(BridgeFrame::DeviceStatus { connected, .. })) => connected,
		Ok(None) => return Err(BridgeError::Closed.into()),
		// An older bridge that does not announce: let the eval itself say whether a device answers.
		_ => true,
	};

	if !device_connected {
		return Ok(EvalOutcome {
			ok: false,
			text: "No device is connected to the debugger bridge. Open Discord with Unbound's debugger enabled.".to_owned(),
			code: Some("no-device".to_owned()),
			device_connected,
		});
	}

	let id = uuid::Uuid::new_v4().to_string();
	socket.send(eval_request(&id, code, timeout_ms)).await?;

	let reply = async {
		while let Some(frame) = next_frame(&mut socket).await {
			if let BridgeFrame::EvalResult {
				id: reply_id,
				ok,
				value,
				error,
				code,
			} = frame
				&& reply_id == id
			{
				let text = if ok { value } else { error };
				return Ok(EvalOutcome {
					ok,
					text: text.unwrap_or_default(),
					code,
					device_connected,
				});
			}
		}

		Err(BridgeError::Closed)
	};
	let outcome = time::timeout(Duration::from_millis(timeout_ms + REPLY_GRACE_MS), reply)
		.await
		.map_err(|_| BridgeError::Timeout(timeout_ms + REPLY_GRACE_MS))??;
	let _ = socket.close(None).await;

	Ok(outcome)
}

pub(crate) async fn next_frame<S>(socket: &mut S) -> Option<BridgeFrame>
where
	S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
	next_text(socket).await.map(|(frame, _)| frame)
}

/// The next frame the bridge sends, with its text. `None` once the socket closes.
pub(crate) async fn next_text<S>(socket: &mut S) -> Option<(BridgeFrame, String)>
where
	S: futures_util::Stream<Item = Result<Message, tokio_tungstenite::tungstenite::Error>> + Unpin,
{
	while let Some(message) = socket.next().await {
		let Ok(Message::Text(text)) = message else {
			if message.is_err() {
				return None;
			}

			continue;
		};

		if let Ok(frame) = serde_json::from_str::<BridgeFrame>(&text) {
			return Some((frame, text.to_string()));
		}
	}

	None
}

/// Checks this client against `@unbound-app/debugger-protocol`'s DevTools contract fixture, which
/// the protocol's own tests check against its TypeScript side.
#[cfg(test)]
mod contract {
	use super::*;
	use serde_json::Value;

	fn fixture() -> Value {
		let path = concat!(
			env!("CARGO_MANIFEST_DIR"),
			"/../../../../packages/debugger-protocol/tests/fixtures/devtools-contract.json"
		);
		let text =
			std::fs::read_to_string(path).expect("the DevTools contract fixture is readable");

		serde_json::from_str(&text).expect("the DevTools contract fixture is JSON")
	}

	fn frame(contract: &Value, name: &str) -> BridgeFrame {
		serde_json::from_value(contract["frames"][name].clone()).expect("the frame deserializes")
	}

	#[test]
	fn names_the_protocol_constants() {
		let contract = fixture();

		assert_eq!(
			contract["defaultBridgePort"],
			u64::from(crate::DEFAULT_BRIDGE_PORT)
		);
		assert_eq!(
			contract["controllerEndpointMarker"],
			CONTROLLER_ENDPOINT_MARKER
		);
	}

	#[test]
	fn sends_the_protocols_eval_request() {
		let contract = fixture();
		let expected = &contract["frames"]["evalRequest"];
		let request = eval_request(
			expected["id"].as_str().unwrap(),
			expected["code"].as_str().unwrap(),
			expected["timeout"].as_u64().unwrap(),
		);
		let sent: Value = serde_json::from_str(request.to_text().expect("the request is text"))
			.expect("the request is JSON");

		assert_eq!(&sent, expected);
	}

	#[test]
	fn reads_the_protocols_reply_frames() {
		let contract = fixture();

		assert!(matches!(
			frame(&contract, "evalOk"),
			BridgeFrame::EvalResult {
				ok: true,
				value: Some(_),
				..
			}
		));
		assert!(matches!(
			frame(&contract, "evalError"),
			BridgeFrame::EvalResult {
				ok: false,
				error: Some(_),
				code: Some(code),
				..
			} if code == "timeout"
		));
		assert!(matches!(
			frame(&contract, "deviceConnected"),
			BridgeFrame::DeviceStatus {
				connected: true,
				..
			}
		));
		assert!(matches!(
			frame(&contract, "deviceDisconnected"),
			BridgeFrame::DeviceStatus {
				connected: false,
				..
			}
		));
	}

	#[test]
	fn sends_the_protocols_view_requests() {
		let contract = fixture();
		let with_id = |mut request: Value, expected: &Value| {
			request["id"] = expected["id"].clone();
			request
		};
		let page = &contract["frames"]["viewsRequest"];
		let details = &contract["frames"]["viewDetailsRequest"];
		let offset = u32::try_from(page["offset"].as_u64().unwrap()).unwrap();

		assert_eq!(
			&with_id(
				crate::views::views_request(page["parent"].as_str().map(str::to_owned), offset),
				page
			),
			page
		);
		assert_eq!(
			&with_id(
				crate::views::view_details_request(details["node"].as_str().unwrap()),
				details
			),
			details
		);
	}

	#[test]
	fn reads_the_protocols_view_replies() {
		let contract = fixture();

		let BridgeFrame::ViewsResult {
			ok: true,
			nodes,
			total: Some(240),
			..
		} = frame(&contract, "viewsPage")
		else {
			panic!("a page of views with its total");
		};
		assert_eq!(nodes.len(), 1);

		let BridgeFrame::ViewDetailsResult {
			ok: true,
			details: Some(details),
			..
		} = frame(&contract, "viewDetailsOk")
		else {
			panic!("a view's details");
		};
		let properties = &details.sections[0].properties;
		assert_eq!(details.class_chain[0], "UILabel");
		assert_eq!(
			properties[0].value,
			crate::views::PropertyValue::Number(16.0)
		);
		assert_eq!(properties[0].unit.as_deref(), Some("pt"));
		assert_eq!(properties[1].kind, Some(crate::views::PropertyKind::Color));
		assert_eq!(
			properties[2].value,
			crate::views::PropertyValue::Bool(false)
		);
		assert_eq!(properties[3].value, crate::views::PropertyValue::Null);

		assert!(matches!(
			frame(&contract, "viewDetailsError"),
			BridgeFrame::ViewDetailsResult {
				ok: false,
				error: Some(_),
				..
			}
		));
	}

	/// The fixture's frames of one `type`, whatever their keys are named.
	fn frames_of(contract: &Value, kind: &str) -> Vec<Value> {
		let frames = contract["frames"]
			.as_object()
			.expect("the fixture has frames");
		let found: Vec<Value> = frames
			.values()
			.filter(|frame| frame["type"] == kind)
			.cloned()
			.collect();
		assert!(!found.is_empty(), "the fixture has a {kind} frame");
		found
	}

	#[test]
	fn sends_the_protocols_explorer_requests() {
		use crate::explorer::{
			ExplorerMemberKind, classes_request, members_request, object_request, values_request,
		};
		let contract = fixture();
		let text = |frame: &Value, key: &str| frame[key].as_str().unwrap_or_default().to_owned();
		let offset = |frame: &Value| u32::try_from(frame["offset"].as_u64().unwrap_or(0)).unwrap();
		let kind = |frame: &Value| -> ExplorerMemberKind {
			serde_json::from_value(frame["kind"].clone()).expect("a member kind")
		};
		let check = |mut sent: Value, expected: &Value| {
			sent["id"] = expected["id"].clone();
			assert_eq!(&sent, expected);
		};

		for expected in frames_of(&contract, "explorer-object-request") {
			let target = serde_json::from_value(expected["target"].clone()).expect("a target");
			check(object_request(&target), &expected);
		}
		for expected in frames_of(&contract, "explorer-members-request") {
			let request = members_request(
				&text(&expected, "className"),
				kind(&expected),
				offset(&expected),
				&text(&expected, "filter"),
			);
			check(request, &expected);
		}
		for expected in frames_of(&contract, "explorer-values-request") {
			let names: Vec<String> =
				serde_json::from_value(expected["names"].clone()).expect("names");
			let request = values_request(
				&text(&expected, "object"),
				&text(&expected, "className"),
				kind(&expected),
				&names,
				expected["invokeGetters"] == true,
			);
			check(request, &expected);
		}
		for expected in frames_of(&contract, "explorer-classes-request") {
			let request = classes_request(
				expected["image"].as_str(),
				&text(&expected, "filter"),
				offset(&expected),
			);
			check(request, &expected);
		}
	}

	#[test]
	fn reads_the_protocols_explorer_replies() {
		let contract = fixture();
		let parse = |frame: Value| -> BridgeFrame {
			serde_json::from_value(frame).expect("the explorer frame deserializes")
		};

		for frame in frames_of(&contract, "explorer-object-result") {
			let ok = frame["ok"] == true;
			let BridgeFrame::ExplorerObjectResult {
				object,
				error,
				code,
				..
			} = parse(frame)
			else {
				panic!("an explorer object result");
			};
			if ok {
				assert!(!object.expect("an object").chain.is_empty());
			} else {
				assert!(error.is_some() && code.is_some());
			}
		}
		for frame in frames_of(&contract, "explorer-members-result") {
			let ok = frame["ok"] == true;
			let BridgeFrame::ExplorerMembersResult {
				members,
				total,
				error,
				..
			} = parse(frame)
			else {
				panic!("an explorer members result");
			};
			assert!(!ok || (!members.is_empty() && total.is_some()));
			assert!(ok || error.is_some());
		}
		for frame in frames_of(&contract, "explorer-values-result") {
			let ok = frame["ok"] == true;
			let BridgeFrame::ExplorerValuesResult { values, error, .. } = parse(frame) else {
				panic!("an explorer values result");
			};
			assert!(!ok || !values.is_empty());
			assert!(ok || error.is_some());
		}
		for frame in frames_of(&contract, "explorer-classes-result") {
			let ok = frame["ok"] == true;
			let BridgeFrame::ExplorerClassesResult {
				images,
				classes,
				error,
				..
			} = parse(frame)
			else {
				panic!("an explorer classes result");
			};
			assert!(!ok || images.is_some() || classes.is_some());
			assert!(ok || error.is_some());
		}
	}
}
