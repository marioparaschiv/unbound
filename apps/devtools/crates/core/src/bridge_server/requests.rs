//! The requests a controller sends through the bridge, what answers each, and the failure the
//! bridge answers with itself. Mirrors `packages/debugger/src/lib/session.ts` and its explorer and
//! Metro sessions; the conformance test runs both bridges through the same exchanges.

use std::time::Duration;

use serde_json::{Value as Json, json};

/// `DEFAULT_EVAL_TIMEOUT_MS` in the protocol.
const DEFAULT_EVAL_TIMEOUT_MS: u64 = 10_000;
/// `MAX_EVAL_TIMEOUT_MS` in the protocol.
const MAX_EVAL_TIMEOUT_MS: u64 = 86_400_000;
/// `PUSH_TIMEOUT_MS` in the protocol.
const PUSH_TIMEOUT_MS: u64 = 60_000;
/// The bridge's wait for views, view details, explorer and Metro answers.
const DEVICE_READ_TIMEOUT_MS: u64 = 15_000;

const NO_DEVICE: &str = "No device is connected to the debugger.";

const EXPLORER_REQUESTS: [&str; 4] = [
	"explorer-object-request",
	"explorer-members-request",
	"explorer-values-request",
	"explorer-classes-request",
];

const METRO_REQUESTS: [&str; 7] = [
	"metro-modules-request",
	"metro-load-request",
	"metro-load-all-request",
	"metro-search-request",
	"metro-files-request",
	"metro-children-request",
	"metro-read-request",
];

/// A request the device answers by id, with the answer routed back to the controller that asked.
#[derive(Clone, Debug, PartialEq, Eq)]
pub(crate) enum Request {
	Eval {
		timeout_ms: u64,
	},
	Push,
	Views,
	ViewDetails,
	/// The explorer request's own type, such as `explorer-object-request`.
	Explorer(&'static str),
	/// The Metro request's own type, such as `metro-load-request`.
	Metro(&'static str),
}

/// Why the bridge answers a request itself.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Failure {
	NoDevice,
	TimedOut,
	DeviceLeft,
}

impl Request {
	/// The request a controller frame makes, when it is one the device answers.
	pub(crate) fn of(frame: &Json) -> Option<Self> {
		let kind = frame["type"].as_str()?;

		match kind {
			"eval" => frame["code"].is_string().then(|| Self::Eval {
				timeout_ms: eval_timeout(&frame["timeout"]),
			}),
			"plugin-push" => Some(Self::Push),
			"views-request" => Some(Self::Views),
			"view-details-request" => Some(Self::ViewDetails),
			kind => EXPLORER_REQUESTS
				.into_iter()
				.find(|known| *known == kind)
				.map(Self::Explorer)
				.or_else(|| {
					METRO_REQUESTS
						.into_iter()
						.find(|known| *known == kind)
						.map(Self::Metro)
				}),
		}
	}

	/// The `type` of the device's answer.
	pub(crate) fn result_type(&self) -> String {
		match self {
			Self::Eval { .. } => "eval-result".to_owned(),
			Self::Push => "plugin-push-result".to_owned(),
			Self::Views => "views-result".to_owned(),
			Self::ViewDetails => "view-details-result".to_owned(),
			Self::Explorer(kind) | Self::Metro(kind) => kind.replace("-request", "-result"),
		}
	}

	pub(crate) fn timeout(&self) -> Duration {
		Duration::from_millis(match self {
			Self::Eval { timeout_ms } => *timeout_ms,
			Self::Push => PUSH_TIMEOUT_MS,
			_ => DEVICE_READ_TIMEOUT_MS,
		})
	}

	/// The frame sent to the device. An eval drops its `timeout`, which only the bridge reads.
	pub(crate) fn forwarded(&self, frame: &Json, raw: &str) -> String {
		match self {
			Self::Eval { .. } => {
				json!({ "type": "eval", "id": frame["id"], "code": frame["code"] }).to_string()
			}
			_ => raw.to_owned(),
		}
	}

	/// The answer the bridge gives in the device's place.
	pub(crate) fn failure(&self, id: &str, failure: Failure) -> Json {
		let (error, code) = match (self, failure) {
			(Self::Eval { .. } | Self::Push, Failure::NoDevice) => {
				(NO_DEVICE.to_owned(), Some("no-device"))
			}
			(Self::Eval { timeout_ms }, Failure::TimedOut) => (
				format!("Evaluation timed out after {timeout_ms}ms."),
				Some("timeout"),
			),
			(Self::Eval { .. }, Failure::DeviceLeft) => (
				"Device disconnected before the evaluation completed.".to_owned(),
				Some("device-disconnected"),
			),
			(Self::Push, Failure::TimedOut) => (
				format!("Push timed out after {PUSH_TIMEOUT_MS}ms."),
				Some("timeout"),
			),
			(Self::Push, Failure::DeviceLeft) => (
				"Device disconnected before the reload completed.".to_owned(),
				Some("device-disconnected"),
			),
			(Self::Views | Self::ViewDetails, Failure::NoDevice) => (NO_DEVICE.to_owned(), None),
			(Self::Views, Failure::TimedOut) => (
				format!("Listing views timed out after {DEVICE_READ_TIMEOUT_MS}ms."),
				None,
			),
			(Self::Views, Failure::DeviceLeft) => (
				"Device disconnected before the views were listed.".to_owned(),
				None,
			),
			(Self::ViewDetails, Failure::TimedOut) => (
				format!("Reading the view timed out after {DEVICE_READ_TIMEOUT_MS}ms."),
				None,
			),
			(Self::ViewDetails, Failure::DeviceLeft) => (
				"Device disconnected before the view was read.".to_owned(),
				None,
			),
			(Self::Explorer(_) | Self::Metro(_), Failure::NoDevice) => {
				(NO_DEVICE.to_owned(), Some("failed"))
			}
			(Self::Explorer(_), Failure::TimedOut) => (
				format!("Exploring timed out after {DEVICE_READ_TIMEOUT_MS}ms."),
				Some("failed"),
			),
			(Self::Explorer(_), Failure::DeviceLeft) => (
				"Device disconnected before the explorer answered.".to_owned(),
				Some("failed"),
			),
			(Self::Metro(_), Failure::TimedOut) => (
				format!("Metro timed out after {DEVICE_READ_TIMEOUT_MS}ms."),
				Some("failed"),
			),
			(Self::Metro(_), Failure::DeviceLeft) => (
				"Device disconnected before Metro answered.".to_owned(),
				Some("failed"),
			),
		};
		let mut answer = json!({
			"type": self.result_type(),
			"id": id,
			"ok": false,
			"error": error,
		});

		if let Some(code) = code {
			answer["code"] = json!(code);
		}

		answer
	}
}

/// `resolveEvalTimeout` in the protocol: a positive request, capped, or the default.
fn eval_timeout(requested: &Json) -> u64 {
	requested
		.as_f64()
		.filter(|timeout| *timeout > 0.0)
		.map_or(DEFAULT_EVAL_TIMEOUT_MS, |timeout| {
			(timeout as u64).clamp(1, MAX_EVAL_TIMEOUT_MS)
		})
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn names_each_answer_type() {
		let load = Request::of(&json!({ "type": "metro-load-request", "id": "1" })).unwrap();

		assert_eq!(load.result_type(), "metro-load-result");
		assert_eq!(
			Request::of(&json!({ "type": "explorer-values-request" }))
				.unwrap()
				.result_type(),
			"explorer-values-result"
		);
		assert_eq!(Request::of(&json!({ "type": "view-highlight" })), None);
	}

	#[test]
	fn resolves_the_eval_timeout_as_the_protocol_does() {
		let eval = |timeout: Json| {
			Request::of(&json!({ "type": "eval", "code": "1", "timeout": timeout }))
		};

		assert_eq!(eval(json!(50)), Some(Request::Eval { timeout_ms: 50 }));
		assert_eq!(
			eval(json!(-1)),
			Some(Request::Eval {
				timeout_ms: DEFAULT_EVAL_TIMEOUT_MS
			})
		);
		assert_eq!(
			eval(json!(1e12)),
			Some(Request::Eval {
				timeout_ms: MAX_EVAL_TIMEOUT_MS
			})
		);
		assert_eq!(Request::of(&json!({ "type": "eval" })), None);
	}
}
