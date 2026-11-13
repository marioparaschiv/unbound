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
use crate::metro::{MetroErrorCode, MetroFile, MetroMatch, MetroModule, MetroValue};
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

/// What this app's bridge tells controllers about itself (`BridgeInfo` in the protocol): the pairing
/// code its Bonjour advertisement carries, and how a phone reaches it by hand when discovery fails.
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeInfo {
	/// Four digits, also in the advertisement's TXT record, so the phone's prompt shows the same.
	pub code: String,
	/// `ip:port` on the advertised LAN interface, for typing into Unbound's Debugger Address.
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub address: Option<String>,
	/// Whether phones on the network can find this bridge.
	pub advertising: bool,
	/// Why it isn't advertising, such as a blocked mDNS socket.
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub error: Option<String>,
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
	BridgeInfo(BridgeInfo),
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
	MetroModulesResult {
		id: String,
		ok: bool,
		#[serde(default)]
		modules: Vec<MetroModule>,
		#[serde(default)]
		total: Option<u32>,
		#[serde(default)]
		loaded: Option<u32>,
		#[serde(default)]
		count: Option<u32>,
		error: Option<String>,
		code: Option<MetroErrorCode>,
	},
	MetroLoadResult {
		id: String,
		ok: bool,
		#[serde(default)]
		module: Option<MetroModule>,
		#[serde(default)]
		loaded: Option<u32>,
		error: Option<String>,
		code: Option<MetroErrorCode>,
	},
	MetroLoadAllResult {
		id: String,
		ok: bool,
		#[serde(default)]
		attempted: Option<u32>,
		#[serde(default)]
		failed: Option<u32>,
		#[serde(default)]
		remaining: Option<u32>,
		#[serde(default)]
		loaded: Option<u32>,
		#[serde(default)]
		count: Option<u32>,
		error: Option<String>,
		code: Option<MetroErrorCode>,
	},
	MetroSearchResult {
		id: String,
		ok: bool,
		#[serde(default)]
		matches: Vec<MetroMatch>,
		/// `None` once every loaded module is searched.
		#[serde(default)]
		cursor: Option<u32>,
		#[serde(default)]
		searched: Option<u32>,
		#[serde(default)]
		total: Option<u32>,
		error: Option<String>,
		code: Option<MetroErrorCode>,
	},
	MetroFilesResult {
		id: String,
		ok: bool,
		#[serde(default)]
		files: Vec<MetroFile>,
		#[serde(default)]
		unloaded: Option<u32>,
		#[serde(default)]
		count: Option<u32>,
		error: Option<String>,
		code: Option<MetroErrorCode>,
	},
	MetroChildrenResult {
		id: String,
		ok: bool,
		#[serde(default)]
		value: Option<MetroValue>,
		#[serde(default)]
		children: Vec<MetroValue>,
		#[serde(default)]
		total: Option<u32>,
		#[serde(default)]
		internal: Vec<MetroValue>,
		error: Option<String>,
		code: Option<MetroErrorCode>,
	},
	MetroReadResult {
		id: String,
		ok: bool,
		#[serde(default)]
		value: Option<MetroValue>,
		error: Option<String>,
		code: Option<MetroErrorCode>,
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
			} = frame && reply_id == id
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

pub(crate) mod launch;

pub use launch::Launcher;

/// Checks this client against `@unbound-app/debugger-protocol`'s DevTools contract fixture, which
/// the protocol's own tests check against its TypeScript side.
#[cfg(test)]
mod contract;
