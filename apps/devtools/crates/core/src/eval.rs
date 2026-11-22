//! Evals over the debugger connection's controller socket, which is already open: no dial, no
//! WebSocket handshake and no wait for `device-status` per eval, and ordered after the frames sent
//! before it, such as `storeAsGlobal`. [`crate::bridge::eval`]'s one-off socket serves when the
//! connection is not attached.

use std::time::Duration;

use tokio::sync::oneshot;

use crate::bridge::{self, BridgeError, BridgeFrame, EvalOutcome, REPLY_GRACE_MS};
use crate::session::{Devtools, Inner};

/// `RequestFailureCode` for an eval the bridge answered itself because no device is attached.
const NO_DEVICE: &str = "no-device";

impl Devtools {
	/// Evaluates `code` over the debugger connection. `None` when it is not attached.
	pub(crate) async fn eval_on_link(
		&self,
		code: &str,
		timeout_ms: u64,
	) -> Option<Result<EvalOutcome, BridgeError>> {
		let id = uuid::Uuid::new_v4().to_string();
		let (reply, response) = oneshot::channel();
		self.inner.evals.lock().insert(id.clone(), reply);

		if !self
			.inner
			.send_to_bridge(bridge::eval_request(&id, code, timeout_ms))
		{
			self.inner.evals.lock().remove(&id);
			return None;
		}

		let wait = timeout_ms + REPLY_GRACE_MS;
		let waited = self
			.on_runtime(tokio::time::timeout(Duration::from_millis(wait), response))
			.await;

		Some(match waited {
			Ok(Ok(Ok(outcome))) => Ok(outcome),
			// The connection dropped and took the waiter with it, or the runtime is shutting down.
			Ok(Ok(Err(_))) | Err(_) => Err(BridgeError::Closed),
			Ok(Err(_)) => {
				self.inner.evals.lock().remove(&id);
				Err(BridgeError::Timeout(wait))
			}
		})
	}
}

/// Delivers an `eval-result` frame to the eval waiting on its id; other frames are ignored.
pub(crate) fn settle(inner: &Inner, frame: BridgeFrame) {
	let BridgeFrame::EvalResult {
		id,
		ok,
		value,
		error,
		code,
	} = frame
	else {
		return;
	};
	let Some(waiter) = inner.evals.lock().remove(&id) else {
		return;
	};
	let device_connected = code.as_deref() != Some(NO_DEVICE);
	let _ = waiter.send(EvalOutcome {
		ok,
		text: if ok { value } else { error }.unwrap_or_default(),
		code,
		device_connected,
	});
}
