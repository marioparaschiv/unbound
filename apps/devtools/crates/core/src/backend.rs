//! The device's React DevTools backend, as the debugger connection (`link.rs`) carries it: the
//! link attaches it when a device connects to the bridge, feeds it every `react-devtools` frame,
//! and detaches it when the device or the bridge goes away.

use std::time::SystemTime;

use tokio::sync::mpsc;

use crate::operations;
use crate::protocol::{self, Inbound, Outbound};
use crate::session::{Backend, ConnectionState, Inner};

impl Inner {
	/// Starts a session with the device behind link `generation`: frames for it go to `outbound`.
	pub(crate) fn attach_backend(&self, generation: u64, outbound: mpsc::UnboundedSender<String>) {
		let filters = {
			let mut state = self.state.lock();
			state.backend = Some(Backend {
				generation,
				outbound,
			});
			state.connection = ConnectionState::Connected {
				backend_version: None,
				since: SystemTime::now(),
			};
			self.reset_tree(&mut state);
			state.filters.clone()
		};

		self.fail_pending_requests();
		tracing::info!("backend attached");

		// The first frame starts the device's session; the filter update makes it send every root.
		for message in [
			Outbound::GetBridgeProtocol,
			Outbound::GetBackendVersion,
			Outbound::GetIfHasUnsupportedRendererVersion,
			Outbound::UpdateComponentFilters(filters),
		] {
			self.send(&message);
		}

		self.bump();
	}

	/// Ends the session of link `generation`, if it is the current one.
	pub(crate) fn detach_backend(&self, generation: u64) {
		let mut state = self.state.lock();

		if !state
			.backend
			.as_ref()
			.is_some_and(|backend| backend.generation == generation)
		{
			return;
		}

		state.backend = None;
		state.connection = ConnectionState::Waiting;
		self.reset_tree(&mut state);
		drop(state);

		self.fail_pending_requests();
		tracing::info!("backend detached");
		self.bump();
	}

	fn fail_pending_requests(&self) {
		self.pending.lock().clear();
	}

	/// Handles one `react-devtools` frame from the device behind link `generation`.
	pub(crate) fn receive(&self, generation: u64, text: &str) {
		let current = self
			.state
			.lock()
			.backend
			.as_ref()
			.is_some_and(|backend| backend.generation == generation);

		if !current {
			return;
		}

		let inbound = match protocol::parse(text) {
			Ok(inbound) => inbound,
			Err(error) => {
				tracing::warn!(%error, "unparseable frame from the backend");
				return;
			}
		};

		match inbound {
			Inbound::Operations(raw) => self.apply_operations(&raw),
			Inbound::InspectedElement(payload) => {
				if let Some(waiter) = self.pending.lock().remove(&payload.response_id) {
					let _ = waiter.send(payload);
				}
			}
			Inbound::BackendVersion(version) => {
				if let ConnectionState::Connected {
					backend_version, ..
				} = &mut self.state.lock().connection
				{
					*backend_version = Some(version);
				}

				self.bump();
			}
			Inbound::UnsupportedRendererVersion => {
				self.state.lock().connection = ConnectionState::UnsupportedRenderer;
				self.bump();
			}
			Inbound::SelectElement(id) => {
				if self.store.read().get(id).is_some() {
					self.state.lock().selected = Some(id);
					self.bump();
				}
			}
			Inbound::ShutdownBackend => {
				self.reset_tree(&mut self.state.lock());
				self.bump();
			}
			Inbound::BackendStatus {
				connected: false,
				error: Some(error),
			} => {
				// Nothing more to send until the device reconnects, after a restart with the backend on.
				let mut state = self.state.lock();
				state.backend = None;
				state.connection = ConnectionState::Unavailable { error };
				self.reset_tree(&mut state);
				drop(state);
				self.bump();
			}
			Inbound::BackendStatus { .. }
			| Inbound::BackendInitialized
			| Inbound::BridgeProtocol(_)
			| Inbound::Other { .. } => {}
		}
	}

	fn apply_operations(&self, raw: &[i64]) {
		let applied = operations::decode(raw)
			.map_err(|error| error.to_string())
			.and_then(|batch| {
				self.store
					.write()
					.apply(&batch)
					.map_err(|error| error.to_string())
			});

		if let Err(error) = applied {
			// The store no longer mirrors the device; a filter update makes the backend remount
			// every root from scratch.
			tracing::warn!(%error, "operations out of sync, asking the backend to resend the tree");
			let filters = {
				let mut state = self.state.lock();
				self.reset_tree(&mut state);
				state.filters.clone()
			};
			self.send(&Outbound::UpdateComponentFilters(filters));
		}

		{
			let mut state = self.state.lock();
			let store = self.store.read();

			if state.selected.is_some_and(|id| store.get(id).is_none()) {
				state.selected = None;
			}

			self.inspections
				.lock()
				.retain(|id, _| store.get(*id).is_some());
		}

		self.bump();
	}
}
