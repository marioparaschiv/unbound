//! [`Devtools`]: the one handle the GUI and MCP share. It owns a tokio runtime on background
//! threads, the WebSocket listener, the store, the pending inspect requests and the selection.
//! Every observable change bumps a revision on [`Devtools::changes`].

use std::collections::HashMap;
use std::future::Future;
use std::net::{IpAddr, Ipv4Addr, SocketAddr};
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime};

use parking_lot::{Mutex, RwLock, RwLockReadGuard};
use serde::Serialize;
use serde_json::Value as Json;
use tokio::sync::{mpsc, oneshot, watch};

use crate::inspect::{InspectedElement, Section};
use crate::protocol::{
	ComponentFilter, InspectedElementPayload, InspectedKind, Outbound, OverrideTarget,
};
use crate::store::{ElementId, ElementKind, RendererId, Store};
use crate::value::{Path, PathSegment, Value};

const INSPECT_TIMEOUT: Duration = Duration::from_secs(5);
pub(crate) const EVAL_TIMEOUT_MS: u64 = 10_000;

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
			listen: SocketAddr::new(
				IpAddr::V4(Ipv4Addr::UNSPECIFIED),
				crate::DEFAULT_DEVTOOLS_PORT,
			),
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
	/// The request itself is malformed (a hook override without a hook id, an unknown path).
	#[error("{0}")]
	Invalid(String),
}

#[derive(Clone)]
pub struct Devtools {
	pub(crate) inner: Arc<Inner>,
}

pub(crate) struct Backend {
	pub(crate) generation: u64,
	pub(crate) peer: SocketAddr,
	pub(crate) outbound: mpsc::UnboundedSender<String>,
}

pub(crate) struct State {
	pub(crate) connection: ConnectionState,
	pub(crate) listen_addr: Option<SocketAddr>,
	pub(crate) bridge: BridgeState,
	pub(crate) selected: Option<ElementId>,
	pub(crate) filters: Vec<ComponentFilter>,
	pub(crate) mcp_url: Option<String>,
	pub(crate) backend: Option<Backend>,
	pub(crate) globals: u32,
}

pub(crate) struct Inner {
	pub(crate) config: Config,
	runtime: Mutex<Option<tokio::runtime::Runtime>>,
	pub(crate) handle: tokio::runtime::Handle,
	pub(crate) store: RwLock<Store>,
	pub(crate) state: Mutex<State>,
	pub(crate) changes: watch::Sender<u64>,
	pub(crate) pending: Mutex<HashMap<u64, oneshot::Sender<InspectedElementPayload>>>,
	pub(crate) inspections: Mutex<HashMap<ElementId, InspectedElement>>,
	pub(crate) next_generation: AtomicU64,
	next_request: AtomicU64,
	pub(crate) presets: Mutex<()>,
	pub(crate) presets_revision: AtomicU64,
}

impl Drop for Inner {
	fn drop(&mut self) {
		// The last handle can drop on a runtime thread; a blocking shutdown would panic there.
		if let Some(runtime) = self.runtime.lock().take() {
			runtime.shutdown_background();
		}
	}
}

impl Inner {
	pub(crate) fn bump(&self) {
		self.changes
			.send_modify(|revision| *revision = revision.wrapping_add(1));
	}

	pub(crate) fn send(&self, message: &Outbound) -> bool {
		let state = self.state.lock();

		state.backend.as_ref().is_some_and(|backend| {
			backend
				.outbound
				.send(crate::protocol::encode(message))
				.is_ok()
		})
	}

	pub(crate) fn reset_tree(&self, state: &mut State) {
		self.store.write().clear();
		self.inspections.lock().clear();
		state.selected = None;
	}
}

/// The default filter hides host components, as the backend does before a frontend says otherwise.
fn hides_host(filter: &ComponentFilter) -> bool {
	matches!(
		filter,
		ComponentFilter::HideKind {
			kind: ElementKind::Host,
			enabled: true
		}
	)
}

impl Devtools {
	/// Starts the runtime and binds `config.listen`. A bind failure is reported through
	/// [`Status::connection`], not here, so the GUI can still open and say why.
	///
	/// # Panics
	///
	/// When the OS refuses to start the runtime's threads.
	pub fn start(config: Config) -> Self {
		let runtime = tokio::runtime::Builder::new_multi_thread()
			.worker_threads(2)
			.thread_name("devtools")
			.enable_all()
			.build()
			.expect("the devtools runtime starts");
		let listener = std::net::TcpListener::bind(config.listen).and_then(|listener| {
			listener.set_nonblocking(true)?;
			Ok(listener)
		});
		let listener = listener.and_then(|listener| Ok((listener.local_addr()?, listener)));
		let connection = match &listener {
			Ok((addr, _)) => ConnectionState::Listening { addr: *addr },
			Err(error) => ConnectionState::Failed {
				error: format!("cannot listen on {}: {error}", config.listen),
			},
		};
		let listen_addr = match &connection {
			ConnectionState::Listening { addr } => Some(*addr),
			_ => None,
		};
		let inner = Arc::new(Inner {
			config,
			handle: runtime.handle().clone(),
			runtime: Mutex::new(Some(runtime)),
			store: RwLock::new(Store::default()),
			state: Mutex::new(State {
				connection,
				listen_addr,
				bridge: BridgeState::Unknown,
				selected: None,
				filters: vec![ComponentFilter::HideKind {
					kind: ElementKind::Host,
					enabled: true,
				}],
				mcp_url: None,
				backend: None,
				globals: 0,
			}),
			changes: watch::channel(0).0,
			pending: Mutex::new(HashMap::new()),
			inspections: Mutex::new(HashMap::new()),
			next_generation: AtomicU64::new(0),
			next_request: AtomicU64::new(0),
			presets: Mutex::new(()),
			presets_revision: AtomicU64::new(0),
		});

		if let Ok((_, listener)) = listener {
			inner
				.handle
				.spawn(crate::server::listen(Arc::downgrade(&inner), listener));
		}

		Self { inner }
	}

	/// The tokio runtime's handle, for front-ends that need to spawn onto it (the MCP server).
	pub fn runtime(&self) -> tokio::runtime::Handle {
		self.inner.handle.clone()
	}

	pub fn store(&self) -> RwLockReadGuard<'_, Store> {
		self.inner.store.read()
	}

	pub fn status(&self) -> Status {
		let state = self.inner.state.lock();
		let store = self.inner.store.read();

		Status {
			connection: state.connection.clone(),
			bridge: state.bridge.clone(),
			elements: store.len(),
			roots: store.roots().len(),
			selected: state.selected,
			show_host_components: !state.filters.iter().any(hides_host),
			mcp_url: state.mcp_url.clone(),
		}
	}

	/// A revision counter bumped on any store, status or selection change. Runtime-agnostic, so
	/// the GUI awaits it on gpui's executor.
	pub fn changes(&self) -> watch::Receiver<u64> {
		self.inner.changes.subscribe()
	}

	pub fn selected(&self) -> Option<ElementId> {
		self.inner.state.lock().selected
	}

	/// Shared by the GUI and MCP: an agent's `select` moves the GUI's selection and vice versa.
	pub fn select(&self, id: Option<ElementId>) {
		self.inner.state.lock().selected = id;
		self.inner.bump();
	}

	pub fn set_mcp_url(&self, url: Option<String>) {
		self.inner.state.lock().mcp_url = url;
		self.inner.bump();
	}

	/// Full inspection of one element. Times out after 5 s.
	pub async fn inspect(&self, id: ElementId) -> Result<InspectedElement, RequestError> {
		let renderer = self.renderer_of(id)?;
		let payload = self
			.request(move |request_id| Outbound::InspectElement {
				id,
				renderer,
				request_id,
				path: None,
				force_full_data: true,
			})
			.await?;

		self.settle(id, payload)
	}

	/// Hydrates one placeholder: `path` starts with the section (`["props", "author", "nested"]`).
	pub async fn inspect_path(&self, id: ElementId, path: Path) -> Result<Value, RequestError> {
		let renderer = self.renderer_of(id)?;
		let request_path = path.clone();
		let payload = self
			.request(move |request_id| Outbound::InspectElement {
				id,
				renderer,
				request_id,
				path: Some(request_path),
				force_full_data: false,
			})
			.await?;

		if payload.kind == InspectedKind::HydratedPath {
			let value = Value::from_dehydrated_at(&payload.value, &path);

			if let Some(cached) = self.inner.inspections.lock().get_mut(&id) {
				cached.set_value_at(&path, value.clone());
			}

			return Ok(value);
		}

		// The backend answers with full data when another element was inspected in between; that
		// data already has `path` hydrated.
		self.settle(id, payload)?
			.value_at(&path)
			.ok_or_else(|| RequestError::Invalid(format!("no value at {}", path_text(&path))))
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
		let renderer = self.renderer_of(id)?;

		if section == Section::Hooks && !matches!(path.first(), Some(PathSegment::Index(_))) {
			return Err(RequestError::Invalid(
				"a hook override's path starts with the hook id, e.g. [0] for the first useState"
					.to_owned(),
			));
		}

		let target = match section {
			Section::Props => OverrideTarget::Props,
			Section::State => OverrideTarget::State,
			Section::Hooks => OverrideTarget::Hooks,
			Section::Context => OverrideTarget::Context,
		};

		if !self.inner.send(&Outbound::OverrideValueAtPath {
			target,
			id,
			renderer,
			path,
			value,
		}) {
			return Err(RequestError::NotConnected);
		}

		self.inner.inspections.lock().remove(&id);
		Ok(())
	}

	/// Highlights the element's host view on device; `None` clears it.
	pub fn highlight(&self, id: Option<ElementId>) {
		let message = id.and_then(|id| {
			let store = self.inner.store.read();
			let element = store.get(id)?;

			Some(Outbound::HighlightHostInstance {
				id,
				renderer: element.renderer,
				display_name: element.name.to_string(),
			})
		});

		self.inner
			.send(&message.unwrap_or(Outbound::ClearHostInstanceHighlight));
	}

	/// Toggles the host-component filter; the backend remounts the tree with new ids.
	pub fn set_show_host_components(&self, show: bool) {
		let mut filters = self.inner.state.lock().filters.clone();
		filters.retain(|filter| !hides_host(filter));

		if !show {
			filters.push(ComponentFilter::HideKind {
				kind: ElementKind::Host,
				enabled: true,
			});
		}

		self.set_component_filters(filters);
	}

	pub fn set_component_filters(&self, filters: Vec<ComponentFilter>) {
		self.inner.state.lock().filters.clone_from(&filters);
		// The remount reassigns ids; its own remove ops empty the store.
		self.inner.inspections.lock().clear();
		self.inner.send(&Outbound::UpdateComponentFilters(filters));
		self.inner.bump();
	}

	/// `storeAsGlobal`: exposes the value at `path` as `$reactTemp<n>` on device, so a bridge
	/// eval can use it. Returns the global's name. The backend resolves `path` against the element
	/// it inspected last, so inspect `id` first.
	pub fn store_as_global(&self, id: ElementId, path: Path) -> Result<String, RequestError> {
		let renderer = self.renderer_of(id)?;
		let count = {
			let mut state = self.inner.state.lock();
			let count = state.globals;
			state.globals += 1;
			count
		};

		if !self.inner.send(&Outbound::StoreAsGlobal {
			id,
			renderer,
			path,
			count,
		}) {
			return Err(RequestError::NotConnected);
		}

		Ok(format!("$reactTemp{count}"))
	}

	fn renderer_of(&self, id: ElementId) -> Result<RendererId, RequestError> {
		self.inner
			.store
			.read()
			.get(id)
			.map(|element| element.renderer)
			.ok_or(RequestError::NotFound(id))
	}

	pub(crate) async fn on_runtime<F>(&self, future: F) -> Result<F::Output, tokio::task::JoinError>
	where
		F: Future + Send + 'static,
		F::Output: Send + 'static,
	{
		self.inner.handle.spawn(future).await
	}

	async fn request(
		&self,
		build: impl FnOnce(u64) -> Outbound,
	) -> Result<InspectedElementPayload, RequestError> {
		let request_id = self.inner.next_request.fetch_add(1, Ordering::Relaxed) + 1;
		let (reply, response) = oneshot::channel();
		self.inner.pending.lock().insert(request_id, reply);

		if !self.inner.send(&build(request_id)) {
			self.inner.pending.lock().remove(&request_id);
			return Err(RequestError::NotConnected);
		}

		let waited = self
			.on_runtime(tokio::time::timeout(INSPECT_TIMEOUT, response))
			.await
			.map_err(|error| RequestError::Device(error.to_string()))?;

		match waited {
			Ok(Ok(payload)) => Ok(payload),
			Ok(Err(_)) => Err(RequestError::NotConnected),
			Err(_) => {
				self.inner.pending.lock().remove(&request_id);
				Err(RequestError::Timeout(INSPECT_TIMEOUT.as_millis() as u64))
			}
		}
	}

	fn settle(
		&self,
		id: ElementId,
		payload: InspectedElementPayload,
	) -> Result<InspectedElement, RequestError> {
		match payload.kind {
			InspectedKind::FullData => {
				let mut element = InspectedElement::from_payload(&payload.value)
					.map_err(|error| RequestError::Device(error.to_string()))?;

				if let Some(stored) = self.inner.store.read().get(id) {
					element.name = stored.name.to_string();
				}

				self.inner.inspections.lock().insert(id, element.clone());
				Ok(element)
			}
			InspectedKind::NoChange => {
				self.inner
					.inspections
					.lock()
					.get(&id)
					.cloned()
					.ok_or_else(|| {
						RequestError::Device("no-change for an element never inspected".into())
					})
			}
			InspectedKind::NotFound => Err(RequestError::NotFound(id)),
			InspectedKind::Error { message } => Err(RequestError::Device(message)),
			InspectedKind::HydratedPath => Err(RequestError::Device(
				"hydrated-path reply to a full inspection".into(),
			)),
		}
	}
}

fn path_text(path: &[PathSegment]) -> String {
	serde_json::to_string(path).unwrap_or_default()
}
