//! A controller client for the Unbound debugger bridge (`packages/debugger`), mirroring
//! `@unbound-app/debugger-protocol`'s `ControllerClient`: dial `ws://<bridge>/?mcp`, send
//! `{type:"eval", id, code, timeout?}`, match the `eval-result` by id. One short-lived socket per
//! call keeps it stateless.

use std::net::SocketAddr;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;
use tokio::time;
use tokio_tungstenite::connect_async;
use tokio_tungstenite::tungstenite::Message;

#[derive(Debug)]
pub struct EvalOutcome {
	pub ok: bool,
	/// `value` when ok, `error` otherwise.
	pub text: String,
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

/// Bridge frames this client reads; everything else (logs, plugin pushes) is skipped.
#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
enum BridgeFrame {
	DeviceStatus {
		connected: bool,
	},
	EvalResult {
		id: String,
		ok: bool,
		value: Option<String>,
		error: Option<String>,
	},
	#[serde(other)]
	Other,
}

const CONNECT_TIMEOUT: Duration = Duration::from_secs(3);
/// The bridge sends `device-status` right after a controller attaches.
const STATUS_WAIT: Duration = Duration::from_millis(1500);
/// Slack on top of the eval timeout for the bridge's own reply.
const REPLY_GRACE_MS: u64 = 2000;

pub async fn eval(bridge: SocketAddr, code: &str, timeout_ms: u64) -> anyhow::Result<EvalOutcome> {
	let unreachable = |reason: String| BridgeError::Unreachable {
		addr: bridge,
		reason,
	};
	let (mut socket, _) = time::timeout(
		CONNECT_TIMEOUT,
		connect_async(format!("ws://{bridge}/?mcp")),
	)
	.await
	.map_err(|_| unreachable("timed out".to_owned()))?
	.map_err(|error| unreachable(error.to_string()))?;

	let device_connected = match time::timeout(STATUS_WAIT, next_frame(&mut socket)).await {
		Ok(Some(BridgeFrame::DeviceStatus { connected })) => connected,
		Ok(None) => return Err(BridgeError::Closed.into()),
		// An older bridge that does not announce: let the eval itself say whether a device answers.
		_ => true,
	};

	if !device_connected {
		return Ok(EvalOutcome {
			ok: false,
			text: "No device is connected to the debugger bridge. Open Discord with Unbound's debugger enabled.".to_owned(),
			device_connected,
		});
	}

	let id = uuid::Uuid::new_v4().to_string();
	let request = json!({ "type": "eval", "id": id, "code": code, "timeout": timeout_ms });
	socket.send(Message::text(request.to_string())).await?;

	let reply = async {
		while let Some(frame) = next_frame(&mut socket).await {
			if let BridgeFrame::EvalResult {
				id: reply_id,
				ok,
				value,
				error,
			} = frame && reply_id == id
			{
				let text = if ok { value } else { error };
				return Ok(EvalOutcome {
					ok,
					text: text.unwrap_or_default(),
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

/// The next frame this client understands, or `None` once the socket closes.
async fn next_frame<S>(socket: &mut S) -> Option<BridgeFrame>
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
			return Some(frame);
		}
	}

	None
}

/// The device-side script `connect_device` evaluates. With `host == None` it reads the host from
/// the client's `debugger.address` setting (falling back to the build-time address), so the
/// device dials the machine it already reaches. Fails with a readable error when the loader was
/// not started with `loader.devtools` on (no `DevTools` global).
pub fn connect_script(host: Option<&str>, port: u16) -> String {
	let host = serde_json::to_string(&host).unwrap_or_else(|_| "null".to_owned());

	CONNECT_SCRIPT
		.replace("__HOST__", &host)
		.replace("__PORT__", &port.to_string())
}

/// The build-time `DEBUGGER_ADDRESS` is not reachable at runtime, so the script relies on the
/// `debugger.address` setting and asks for `--advertise-host` when it is empty.
const CONNECT_SCRIPT: &str = r#"(() => {
	const devtools = globalThis.DevTools;
	if (!devtools || typeof devtools.connect !== 'function') {
		throw new Error("React DevTools is not loaded on this device. Enable loader.devtools in Unbound's loader settings and restart Discord.");
	}
	const port = __PORT__;
	let host = __HOST__;
	if (host === null) {
		const storage = globalThis.unbound && globalThis.unbound.storage;
		const address = String((storage && storage.get('unbound', 'debugger.address', '')) || '');
		const match = /^\[([^\]]+)\]|^([^:/]+)/.exec(address.replace(/^wss?:\/\//, ''));
		host = match ? match[1] || match[2] : null;
	}
	if (!host) {
		throw new Error("Cannot tell which host to dial: Unbound's debugger.address setting is empty. Set it, or start the DevTools app with an advertise host.");
	}
	const url = 'ws://' + (host.indexOf(':') >= 0 ? '[' + host + ']' : host) + ':' + port;
	// Each connect() starts a retry loop that never ends; a second one for the same URL would
	// fight the first for the frontend's single slot.
	if (globalThis.__UNBOUND_DEVTOOLS_URL__ !== url) {
		globalThis.__UNBOUND_DEVTOOLS_URL__ = url;
		devtools.connect({ host, port });
	}
	return url;
})()"#;
