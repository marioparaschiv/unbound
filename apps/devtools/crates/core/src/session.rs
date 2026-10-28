//! [`Devtools`]: the one handle the GUI and MCP share. It owns a tokio runtime on background
//! threads, the WebSocket listener, the store, the pending inspect requests and the selection.
//! Every observable change bumps a revision on [`Devtools::changes`].

use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::time::SystemTime;

use parking_lot::RwLockReadGuard;
use serde::Serialize;
use serde_json::Value as Json;

use crate::inspect::{InspectedElement, Section};
use crate::protocol::ComponentFilter;
use crate::store::{ElementId, Store};
use crate::value::{Path, Value};

#[derive(Clone, Debug)]
pub struct Config {
	/// Where backends dial (`0.0.0.0:8097` so a phone on the LAN or tailnet reaches it).
	pub listen: SocketAddr,
	/// The Unbound debugger bridge, for `connect_device`.
	pub bridge: SocketAddr,
	/// The host a device should dial to reach `listen`. `None`: derive it from the device's own
	/// `debugger.address` setting, which already points at this machine.
	pub advertise_host: Option<String>,
}

impl Default for Config {
	fn default() -> Self {
		Self {
			listen: SocketAddr::new(IpAddr::V4(Ipv4Addr::UNSPECIFIED), crate::DEFAULT_DEVTOOLS_PORT),
			bridge: SocketAddr::new(IpAddr::V4(Ipv4Addr::LOCALHOST), crate::DEFAULT_BRIDGE_PORT),
			advertise_host: None,
		}
	}
}

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum ConnectionState {
	/// Bound and waiting for a backend.
	Listening { addr: SocketAddr },
	Connected {
		peer: SocketAddr,
		backend_version: Option<String>,
		since: SystemTime,
	},
	/// The backend attached but its renderer is newer than it supports.
	UnsupportedRenderer { peer: SocketAddr },
	/// Could not bind `listen`.
	Failed { error: String },
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum BridgeState {
	/// Not tried yet.
	Unknown,
	Unreachable,
	NoDevice,
	DeviceConnected,
}

#[derive(Clone, Debug, Serialize)]
pub struct Status {
	pub connection: ConnectionState,
	pub bridge: BridgeState,
	pub elements: usize,
	pub roots: usize,
	pub selected: Option<ElementId>,
	pub show_host_components: bool,
	/// The MCP endpoint the GUI serves, when it does.
	pub mcp_url: Option<String>,
}

#[derive(Debug, thiserror::Error)]
pub enum RequestError {
	#[error("no device is connected")]
	NotConnected,
	#[error("element {0:?} is not in the tree")]
	NotFound(ElementId),
	#[error("the device did not answer within {0} ms")]
	Timeout(u64),
	#[error("the device failed: {0}")]
	Device(String),
}

#[derive(Clone)]
pub struct Devtools {
	inner: Arc<Inner>,
}

struct Inner {}

impl Devtools {
	/// Starts the runtime and binds `config.listen`. A bind failure is reported through
	/// [`Status::connection`], not here, so the GUI can still open and say why.
	pub fn start(config: Config) -> Self {
		todo!()
	}

	/// The tokio runtime's handle, for front-ends that need to spawn onto it (the MCP server).
	pub fn runtime(&self) -> tokio::runtime::Handle {
		todo!()
	}

	pub fn store(&self) -> RwLockReadGuard<'_, Store> {
		todo!()
	}

	pub fn status(&self) -> Status {
		todo!()
	}

	/// A revision counter bumped on any store, status or selection change. Runtime-agnostic, so
	/// the GUI awaits it on gpui's executor.
	pub fn changes(&self) -> tokio::sync::watch::Receiver<u64> {
		todo!()
	}

	pub fn selected(&self) -> Option<ElementId> {
		todo!()
	}

	/// Shared by the GUI and MCP: an agent's `select` moves the GUI's selection and vice versa.
	pub fn select(&self, id: Option<ElementId>) {
		todo!()
	}

	pub fn set_mcp_url(&self, url: Option<String>) {
		todo!()
	}

	/// Full inspection of one element. Times out after 5 s.
	pub async fn inspect(&self, id: ElementId) -> Result<InspectedElement, RequestError> {
		todo!()
	}

	/// Hydrates one placeholder: `path` starts with the section (`["props", "author", "nested"]`).
	pub async fn inspect_path(&self, id: ElementId, path: Path) -> Result<Value, RequestError> {
		todo!()
	}

	/// Edits a prop, state key, hook value or context value on device. For hooks, `path` starts
	/// with the hook id.
	pub async fn override_value(
		&self,
		id: ElementId,
		section: Section,
		path: Path,
		value: Json,
	) -> Result<(), RequestError> {
		todo!()
	}

	/// Highlights the element's host view on device; `None` clears it.
	pub fn highlight(&self, id: Option<ElementId>) {
		todo!()
	}

	/// Toggles the host-component filter; the backend remounts the tree with new ids.
	pub fn set_show_host_components(&self, show: bool) {
		todo!()
	}

	pub fn set_component_filters(&self, filters: Vec<ComponentFilter>) {
		todo!()
	}

	/// `storeAsGlobal`: exposes the value at `path` as `$reactTemp<n>` on device, so a bridge
	/// eval can use it. Returns the global's name.
	pub fn store_as_global(&self, id: ElementId, path: Path) -> Result<String, RequestError> {
		todo!()
	}

	/// Asks the device, over the Unbound debugger bridge, to dial this frontend
	/// (`DevTools.connect`). Returns the address the device was told to dial.
	pub async fn connect_device(&self) -> anyhow::Result<String> {
		todo!()
	}

	/// Evaluates JavaScript on device over the bridge. Pairs with [`Self::store_as_global`].
	pub async fn eval(&self, code: &str) -> anyhow::Result<String> {
		todo!()
	}
}
