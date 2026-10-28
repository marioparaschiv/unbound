//! Bridge frames: every WebSocket text message is `{"event": string, "payload": any}`.
//! Inbound frames are parsed once here; the rest of the crate never sees raw JSON events.

use serde::Serialize;
use serde_json::Value as Json;

use crate::store::{ElementId, RendererId};
use crate::value::Path;

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
	Other { event: String },
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

pub fn parse(text: &str) -> Result<Inbound, serde_json::Error> {
	todo!()
}

pub fn encode(message: &Outbound) -> String {
	todo!()
}
