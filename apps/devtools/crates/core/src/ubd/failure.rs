//! Why a `ubd` command failed, read from what `ubd … --json` prints: the CLI's `CommandError`
//! (`@unbound-app/debugger-protocol/registry`), checked against the protocol's contract fixture.

use serde::Deserialize;
use serde_json::Value;

/// The CLI's `CommandErrorCode`; a code this build does not know reads as [`ErrorCode::Other`].
#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ErrorCode {
	InvalidInput,
	NoDevice,
	DeviceDisconnected,
	Timeout,
	BridgeUnreachable,
	ShutDown,
	DeviceError,
	NotFound,
	ToolFailed,
	Unsupported,
	CommandFailed,
	#[serde(other)]
	Other,
}

impl ErrorCode {
	/// The code as the CLI spells it.
	pub fn as_str(self) -> &'static str {
		match self {
			Self::InvalidInput => "invalid-input",
			Self::NoDevice => "no-device",
			Self::DeviceDisconnected => "device-disconnected",
			Self::Timeout => "timeout",
			Self::BridgeUnreachable => "bridge-unreachable",
			Self::ShutDown => "shut-down",
			Self::DeviceError => "device-error",
			Self::NotFound => "not-found",
			Self::ToolFailed => "tool-failed",
			Self::Unsupported => "unsupported",
			Self::CommandFailed => "command-failed",
			Self::Other => "error",
		}
	}
}

/// A failed command's reason: what went wrong, what to do, and the form field it is about.
#[derive(Clone, Debug, PartialEq, Eq, Deserialize)]
pub struct CommandError {
	pub code: ErrorCode,
	pub message: String,
	#[serde(default)]
	pub hint: Option<String>,
	/// The schema property at fault, for the form to highlight.
	#[serde(default)]
	pub field: Option<String>,
	#[serde(default)]
	pub stack: Option<String>,
}

impl CommandError {
	/// Reads the failure from the JSON line a failed `ubd … --json` printed last: an object carrying
	/// an `error` object, or a failed `eval-result`, whose `code` is the bridge's.
	pub fn from_json_line(line: &str) -> Option<Self> {
		let value: Value = serde_json::from_str(line.trim()).ok()?;
		let error = value.get("error")?;
		if error.is_object() {
			return serde_json::from_value(error.clone()).ok();
		}
		if value.get("type")?.as_str()? != "eval-result" || value.get("ok")? != false {
			return None;
		}
		let code = value
			.get("code")
			.and_then(|code| serde_json::from_value(code.clone()).ok())
			.unwrap_or(ErrorCode::DeviceError);
		Some(Self {
			code,
			message: error.as_str()?.to_owned(),
			hint: None,
			field: None,
			stack: None,
		})
	}
}

#[cfg(test)]
mod contract {
	use super::*;

	fn fixture() -> Value {
		let path = concat!(
			env!("CARGO_MANIFEST_DIR"),
			"/../../../../packages/debugger-protocol/tests/fixtures/devtools-contract.json"
		);
		let text =
			std::fs::read_to_string(path).expect("the DevTools contract fixture is readable");
		serde_json::from_str(&text).expect("the DevTools contract fixture is JSON")
	}

	fn read(value: &Value) -> CommandError {
		CommandError::from_json_line(&value.to_string()).expect("the failure reads")
	}

	#[test]
	fn knows_every_code_the_cli_sends() {
		let contract = fixture();
		for code in contract["commandErrorCodes"]
			.as_array()
			.expect("a code list")
		{
			let parsed: ErrorCode = serde_json::from_value(code.clone()).expect("a code");
			assert_ne!(parsed, ErrorCode::Other, "{code} is unknown");
			assert_eq!(parsed.as_str(), code.as_str().unwrap());
		}
	}

	#[test]
	fn reads_the_cli_failures() {
		let contract = fixture();
		let failures = &contract["cliFailures"];

		let coded = read(&failures["coded"]);
		assert_eq!(coded.code, ErrorCode::NoDevice);
		assert_eq!(coded.hint.as_deref(), Some("Start the bridge."));

		let input = read(&failures["invalidInput"]);
		assert_eq!(input.code, ErrorCode::InvalidInput);
		assert_eq!(input.field.as_deref(), Some("timeout"));

		assert_eq!(read(&failures["withData"]).code, ErrorCode::CommandFailed);
	}

	#[test]
	fn reads_a_failed_eval_by_its_request_code() {
		let error = read(&fixture()["frames"]["evalError"]);
		assert_eq!(error.code, ErrorCode::Timeout);
		assert_eq!(error.message, "Timed out");
	}

	#[test]
	fn ignores_success_and_unknown_codes_read_as_other() {
		assert_eq!(CommandError::from_json_line(r#"{"count":1}"#), None);
		assert_eq!(
			CommandError::from_json_line(r#"{"type":"eval-result","ok":true,"value":"2"}"#),
			None
		);
		assert_eq!(CommandError::from_json_line("not json"), None);
		let other = CommandError::from_json_line(r#"{"error":{"code":"new","message":"x"}}"#);
		assert_eq!(other.map(|error| error.code), Some(ErrorCode::Other));
	}
}
