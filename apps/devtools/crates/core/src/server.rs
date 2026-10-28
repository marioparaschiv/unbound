use std::net::SocketAddr;
use std::sync::Weak;
use std::sync::atomic::Ordering;
use std::time::SystemTime;

use futures_util::{SinkExt, StreamExt};
use tokio::net::TcpListener;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use crate::operations;
use crate::protocol::{self, Inbound, Outbound};
use crate::session::{Backend, ConnectionState, Inner};

pub(crate) async fn listen(inner: Weak<Inner>, listener: std::net::TcpListener) {
	let listener = match TcpListener::from_std(listener) {
		Ok(listener) => listener,
		Err(error) => {
			if let Some(inner) = inner.upgrade() {
				inner.state.lock().connection = ConnectionState::Failed {
					error: error.to_string(),
				};
				inner.bump();
			}

			return;
		}
	};

	loop {
		let Ok((stream, peer)) = listener.accept().await else {
			continue;
		};

		if inner.strong_count() == 0 {
			return;
		}

		tokio::spawn(serve(inner.clone(), stream, peer));
	}
}

async fn serve(inner: Weak<Inner>, stream: tokio::net::TcpStream, peer: SocketAddr) {
	let socket = match tokio_tungstenite::accept_async(stream).await {
		Ok(socket) => socket,
		Err(error) => {
			tracing::debug!(%peer, %error, "not a WebSocket handshake");
			return;
		}
	};
	let (mut sink, mut source) = socket.split();
	let (outbound, mut queue) = mpsc::unbounded_channel::<String>();
	let Some(generation) = inner.upgrade().map(|inner| inner.attach(peer, outbound)) else {
		return;
	};

	let writer = tokio::spawn(async move {
		while let Some(text) = queue.recv().await {
			if sink.send(Message::text(text)).await.is_err() {
				break;
			}
		}

		let _ = sink.close().await;
	});

	while let Some(message) = source.next().await {
		let Some(inner) = inner.upgrade() else {
			break;
		};

		match message {
			Ok(Message::Text(text)) if inner.is_current(generation) => inner.receive(&text),
			Ok(Message::Text(_)) | Ok(Message::Close(_)) | Err(_) => break,
			Ok(_) => {}
		}
	}

	if let Some(inner) = inner.upgrade() {
		inner.detach(generation);
	}

	writer.abort();
}

impl Inner {
	fn attach(&self, peer: SocketAddr, outbound: mpsc::UnboundedSender<String>) -> u64 {
		let generation = self.next_generation.fetch_add(1, Ordering::Relaxed) + 1;
		let filters = {
			let mut state = self.state.lock();
			state.backend = Some(Backend {
				generation,
				peer,
				outbound,
			});
			state.connection = ConnectionState::Connected {
				peer,
				backend_version: None,
				since: SystemTime::now(),
			};
			self.reset_tree(&mut state);
			state.filters.clone()
		};

		self.pending.lock().clear();
		tracing::info!(%peer, "backend connected");

		for message in [
			Outbound::GetBridgeProtocol,
			Outbound::GetBackendVersion,
			Outbound::GetIfHasUnsupportedRendererVersion,
			Outbound::UpdateComponentFilters(filters),
		] {
			self.send(&message);
		}

		self.bump();
		generation
	}

	fn is_current(&self, generation: u64) -> bool {
		self.state
			.lock()
			.backend
			.as_ref()
			.is_some_and(|backend| backend.generation == generation)
	}

	fn detach(&self, generation: u64) {
		let mut state = self.state.lock();

		if !state
			.backend
			.as_ref()
			.is_some_and(|backend| backend.generation == generation)
		{
			return;
		}

		state.backend = None;
		state.connection = match state.listen_addr {
			Some(addr) => ConnectionState::Listening { addr },
			None => ConnectionState::Failed {
				error: "not listening".to_owned(),
			},
		};
		self.reset_tree(&mut state);
		drop(state);

		self.pending.lock().clear();
		tracing::info!("backend disconnected");
		self.bump();
	}

	fn receive(&self, text: &str) {
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
				let mut state = self.state.lock();

				if let Some(peer) = state.backend.as_ref().map(|backend| backend.peer) {
					state.connection = ConnectionState::UnsupportedRenderer { peer };
				}

				drop(state);
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
			Inbound::BackendInitialized | Inbound::BridgeProtocol(_) | Inbound::Other { .. } => {}
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
