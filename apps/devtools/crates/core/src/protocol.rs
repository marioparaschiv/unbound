//! Bridge frames: every WebSocket text message is `{"event": string, "payload": any}`.
//! Inbound frames are parsed once here; the rest of the crate never sees raw JSON events.

use serde::{Deserialize, Serialize};
use serde_json::{Value as Json, json};

use crate::store::{ElementId, RendererId};
use crate::value::{Path, PathSegment};

/// Backend → frontend, the events this frontend acts on.
#[derive(Debug)]
pub enum Inbound {
	Operations(Vec<i64>),
	InspectedElement(InspectedElementPayload),
	BackendVersion(String),
	BridgeProtocol(Json),
	BackendInitialized,
	UnsupportedRendererVersion,
	/// The user picked an element on device (`selectElement` / `selectFiber`).
	SelectElement(ElementId),
	ShutdownBackend,
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
pub enum Outbound {
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
	OverrideValueAtPath {
		target: OverrideTarget,
		id: ElementId,
		renderer: RendererId,
		path: Path,
		value: Json,
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

pub fn parse(text: &str) -> Result<Inbound, serde_json::Error> {
	let Frame { event, payload } = serde_json::from_str(text)?;

	Ok(match event.as_str() {
		"operations" => Inbound::Operations(serde_json::from_value(payload)?),
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

			Inbound::InspectedElement(InspectedElementPayload {
				id: raw.id,
				response_id: raw.response_id,
				kind,
				value: raw.value,
				path: raw.path,
			})
		}
		"backendVersion" => Inbound::BackendVersion(serde_json::from_value(payload)?),
		"bridgeProtocol" => Inbound::BridgeProtocol(payload),
		"backendInitialized" => Inbound::BackendInitialized,
		"unsupportedRendererVersion" => Inbound::UnsupportedRendererVersion,
		"selectElement" | "selectFiber" => match payload.as_i64() {
			Some(id) => Inbound::SelectElement(ElementId(id)),
			None => Inbound::Other { event },
		},
		"shutdown" | "shutdownBackend" => Inbound::ShutdownBackend,
		_ => Inbound::Other { event },
	})
}

pub fn encode(message: &Outbound) -> String {
	let (event, payload) = match message {
		Outbound::GetBridgeProtocol => ("getBridgeProtocol", Json::Null),
		Outbound::GetBackendVersion => ("getBackendVersion", Json::Null),
		Outbound::GetIfHasUnsupportedRendererVersion => {
			("getIfHasUnsupportedRendererVersion", Json::Null)
		}
		Outbound::InspectElement {
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
		Outbound::OverrideValueAtPath {
			target,
			id,
			renderer,
			path,
			value,
		} => {
			// Hook overrides address the hook by `hookID` and the path inside its value.
			let (hook_id, path) = match (target, path.split_first()) {
				(OverrideTarget::Hooks, Some((PathSegment::Index(hook), rest))) => {
					(Some(*hook), rest)
				}
				_ => (None, path.as_slice()),
			};

			(
				"overrideValueAtPath",
				json!({
					"hookID": hook_id,
					"id": id,
					"path": path,
					"rendererID": renderer,
					"type": target,
					"value": value,
				}),
			)
		}
		Outbound::HighlightHostInstance {
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
		Outbound::ClearHostInstanceHighlight => ("clearHostInstanceHighlight", Json::Null),
		Outbound::UpdateComponentFilters(filters) => (
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
		Outbound::StoreAsGlobal {
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
		Json::Null => json!({ "event": event }),
		payload => json!({ "event": event, "payload": payload }),
	};

	frame.to_string()
}
