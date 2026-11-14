//! React DevTools frames: `{"event": string, "payload": any}`, carried over the debugger
//! connection as `{"type": "react-devtools", ...}` (`ReactDevtoolsFrame` in the protocol).
//! Inbound frames are parsed once here; the rest of the crate never sees raw JSON events.

use serde::{Deserialize, Serialize};
use serde_json::{Value as Json, json};

use crate::store::{ElementId, RendererId};
use crate::value::{Path, PathSegment};

/// Backend → frontend, the events this frontend acts on.
#[derive(Debug)]
pub enum ReactInbound {
	Operations(Vec<i64>),
	InspectedElement(InspectedElementPayload),
	BackendVersion(String),
	BridgeProtocol(Json),
	BackendInitialized,
	UnsupportedRendererVersion,
	/// The user picked an element on device (`selectElement` / `selectFiber`).
	SelectElement(ElementId),
	ShutdownBackend,
	/// Unbound's own event: the device started a backend session, could not, or ended one.
	BackendStatus {
		connected: bool,
		error: Option<String>,
	},
	/// Anything else, kept for logging.
	Other {
		event: String,
	},
}

#[derive(Debug)]
pub struct InspectedElementPayload {
	pub id: ElementId,
	pub response_id: u64,
	pub kind: InspectedKind,
	/// `full-data`: the dehydrated element. `hydrated-path`: the value at `path`.
	pub value: Json,
	pub path: Option<Path>,
}

#[derive(Debug, PartialEq)]
pub enum InspectedKind {
	FullData,
	HydratedPath,
	NoChange,
	NotFound,
	Error { message: String },
}

/// Frontend → backend.
#[derive(Debug, Clone)]
pub enum ReactOutbound {
	GetBridgeProtocol,
	GetBackendVersion,
	GetIfHasUnsupportedRendererVersion,
	InspectElement {
		id: ElementId,
		renderer: RendererId,
		request_id: u64,
		path: Option<Path>,
		force_full_data: bool,
	},
	/// `value: None` sets `undefined`. Hook paths start with the hook id, as for every edit below.
	OverrideValueAtPath {
		target: OverrideTarget,
		id: ElementId,
		renderer: RendererId,
		path: Path,
		value: Option<Json>,
	},
	DeletePath {
		target: OverrideTarget,
		id: ElementId,
		renderer: RendererId,
		path: Path,
	},
	RenamePath {
		target: OverrideTarget,
		id: ElementId,
		renderer: RendererId,
		old_path: Path,
		new_path: Path,
	},
	/// Shows a Suspense boundary's fallback, or lets it show its children again.
	OverrideSuspense {
		id: ElementId,
		renderer: RendererId,
		force_fallback: bool,
	},
	/// Puts an error boundary into its errored state, or clears it.
	OverrideError {
		id: ElementId,
		renderer: RendererId,
		force_error: bool,
	},
	HighlightHostInstance {
		id: ElementId,
		renderer: RendererId,
		display_name: String,
	},
	ClearHostInstanceHighlight,
	UpdateComponentFilters(Vec<ComponentFilter>),
	/// `storeAsGlobal`: makes the value at `path` a `$reactTemp<n>` global on device.
	StoreAsGlobal {
		id: ElementId,
		renderer: RendererId,
		path: Path,
		count: u32,
	},
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum OverrideTarget {
	Props,
	State,
	Hooks,
	Context,
}

/// react-devtools-shared's `ComponentFilter`. Only the element-type filter is exposed for now.
#[derive(Debug, Clone, PartialEq)]
pub enum ComponentFilter {
	HideKind {
		kind: crate::store::ElementKind,
		enabled: bool,
	},
}

/// `ComponentFilterElementType` in react-devtools-shared's `types.js`.
const COMPONENT_FILTER_ELEMENT_TYPE: i64 = 1;

/// The bridge message type that wraps one React DevTools frame.
pub const FRAME_TYPE: &str = "react-devtools";
/// `REACT_DEVTOOLS_STATUS_EVENT` in the protocol.
const STATUS_EVENT: &str = "unbound:backend-status";

#[derive(Deserialize)]
struct RawStatus {
	connected: bool,
	#[serde(default)]
	error: Option<String>,
}

#[derive(Deserialize)]
struct Frame {
	event: String,
	#[serde(default)]
	payload: Json,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RawInspected {
	id: ElementId,
	#[serde(rename = "responseID")]
	response_id: u64,
	#[serde(rename = "type")]
	kind: String,
	#[serde(default)]
	value: Json,
	#[serde(default)]
	path: Option<Path>,
	#[serde(default)]
	message: Option<String>,
}

pub fn parse(text: &str) -> Result<ReactInbound, serde_json::Error> {
	let Frame { event, payload } = serde_json::from_str(text)?;

	Ok(match event.as_str() {
		"operations" => ReactInbound::Operations(serde_json::from_value(payload)?),
		"inspectedElement" => {
			let raw: RawInspected = serde_json::from_value(payload)?;
			let kind = match raw.kind.as_str() {
				"full-data" => InspectedKind::FullData,
				"hydrated-path" => InspectedKind::HydratedPath,
				"no-change" => InspectedKind::NoChange,
				"not-found" => InspectedKind::NotFound,
				_ => InspectedKind::Error {
					message: raw
						.message
						.unwrap_or_else(|| format!("inspection failed ({})", raw.kind)),
				},
			};

			ReactInbound::InspectedElement(InspectedElementPayload {
				id: raw.id,
				response_id: raw.response_id,
				kind,
				value: raw.value,
				path: raw.path,
			})
		}
		"backendVersion" => ReactInbound::BackendVersion(serde_json::from_value(payload)?),
		"bridgeProtocol" => ReactInbound::BridgeProtocol(payload),
		"backendInitialized" => ReactInbound::BackendInitialized,
		"unsupportedRendererVersion" => ReactInbound::UnsupportedRendererVersion,
		"selectElement" | "selectFiber" => match payload.as_i64() {
			Some(id) => ReactInbound::SelectElement(ElementId(id)),
			None => ReactInbound::Other { event },
		},
		"shutdown" | "shutdownBackend" => ReactInbound::ShutdownBackend,
		STATUS_EVENT => {
			let RawStatus { connected, error } = serde_json::from_value(payload)?;
			ReactInbound::BackendStatus { connected, error }
		}
		_ => ReactInbound::Other { event },
	})
}

/// The bridge frame for `message`, ready to send on the debugger connection.
pub fn encode(message: &ReactOutbound) -> String {
	let (event, payload) = match message {
		ReactOutbound::GetBridgeProtocol => ("getBridgeProtocol", Json::Null),
		ReactOutbound::GetBackendVersion => ("getBackendVersion", Json::Null),
		ReactOutbound::GetIfHasUnsupportedRendererVersion => {
			("getIfHasUnsupportedRendererVersion", Json::Null)
		}
		ReactOutbound::InspectElement {
			id,
			renderer,
			request_id,
			path,
			force_full_data,
		} => (
			"inspectElement",
			json!({
				"forceFullData": force_full_data,
				"id": id,
				"path": path,
				"rendererID": renderer,
				"requestID": request_id,
			}),
		),
		ReactOutbound::OverrideValueAtPath {
			target,
			id,
			renderer,
			path,
			value,
		} => {
			let (hook_id, path) = split_hook(*target, path);
			let mut payload = json!({
				"hookID": hook_id,
				"id": id,
				"path": path,
				"rendererID": renderer,
				"type": target,
			});

			// JSON has no `undefined`: a payload without `value` reads as undefined on device.
			if let Some(value) = value {
				payload["value"] = value.clone();
			}

			("overrideValueAtPath", payload)
		}
		ReactOutbound::DeletePath {
			target,
			id,
			renderer,
			path,
		} => {
			let (hook_id, path) = split_hook(*target, path);

			(
				"deletePath",
				json!({
					"hookID": hook_id,
					"id": id,
					"path": path,
					"rendererID": renderer,
					"type": target,
				}),
			)
		}
		ReactOutbound::RenamePath {
			target,
			id,
			renderer,
			old_path,
			new_path,
		} => {
			let (hook_id, old_path) = split_hook(*target, old_path);
			let (_, new_path) = split_hook(*target, new_path);

			(
				"renamePath",
				json!({
					"hookID": hook_id,
					"id": id,
					"newPath": new_path,
					"oldPath": old_path,
					"rendererID": renderer,
					"type": target,
				}),
			)
		}
		ReactOutbound::OverrideSuspense {
			id,
			renderer,
			force_fallback,
		} => (
			"overrideSuspense",
			json!({ "forceFallback": force_fallback, "id": id, "rendererID": renderer }),
		),
		ReactOutbound::OverrideError {
			id,
			renderer,
			force_error,
		} => (
			"overrideError",
			json!({ "forceError": force_error, "id": id, "rendererID": renderer }),
		),
		ReactOutbound::HighlightHostInstance {
			id,
			renderer,
			display_name,
		} => (
			"highlightHostInstance",
			json!({
				"displayName": display_name,
				"hideAfterTimeout": true,
				"id": id,
				"openBuiltinElementsPanel": false,
				"rendererID": renderer,
				"scrollIntoView": false,
			}),
		),
		ReactOutbound::ClearHostInstanceHighlight => ("clearHostInstanceHighlight", Json::Null),
		ReactOutbound::UpdateComponentFilters(filters) => (
			"updateComponentFilters",
			filters
				.iter()
				.map(|filter| match filter {
					ComponentFilter::HideKind { kind, enabled } => json!({
						"type": COMPONENT_FILTER_ELEMENT_TYPE,
						"value": kind.wire(),
						"isEnabled": enabled,
					}),
				})
				.collect(),
		),
		ReactOutbound::StoreAsGlobal {
			id,
			renderer,
			path,
			count,
		} => (
			"storeAsGlobal",
			json!({ "count": count, "id": id, "path": path, "rendererID": renderer }),
		),
	};

	let frame = match payload {
		Json::Null => json!({ "type": FRAME_TYPE, "event": event }),
		payload => json!({ "type": FRAME_TYPE, "event": event, "payload": payload }),
	};

	frame.to_string()
}

/// Hook edits address the hook by `hookID` and the path inside its value; other paths pass through.
fn split_hook(target: OverrideTarget, path: &[PathSegment]) -> (Option<usize>, &[PathSegment]) {
	match (target, path.split_first()) {
		(OverrideTarget::Hooks, Some((PathSegment::Index(hook), rest))) => (Some(*hook), rest),
		_ => (None, path),
	}
}
