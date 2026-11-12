//! The debugger connection: the one Unbound debugger bridge this app stays attached to. Its
//! supervisor keeps a controller socket open, mirrors the bridge's `device-status`, and carries
//! the device's React DevTools backend and view finder over it. A lost bridge is redialled with
//! backoff, so a restarted bridge or Discord reconnects on its own.

use std::sync::{Arc, Weak};
use std::time::Duration;

use futures_util::SinkExt;
use serde::Serialize;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::Message;

use crate::bridge::{self, BridgeFrame, DeviceInfo};
use crate::presets::{BridgeAddr, ConnectTarget};
use crate::session::{BridgeState, Devtools, Inner};
use crate::{explorer, views};

const MIN_BACKOFF: Duration = Duration::from_secs(1);
const MAX_BACKOFF: Duration = Duration::from_secs(10);

/// What the debugger connection is doing, for the GUI's banner and MCP's `status`.
#[derive(Clone, Debug, Serialize)]
pub struct LinkStatus {
	/// The saved device it dials; `None` for this machine's bridge or a one-off address.
	pub name: Option<String>,
	pub bridge: BridgeAddr,
	/// `Unknown` while the bridge is being dialled.
	pub state: BridgeState,
	/// The attached device, once it has said hello.
	pub device: Option<DeviceInfo>,
	/// Why the bridge was lost, until the next attempt succeeds.
	pub error: Option<String>,
}

pub(crate) struct Link {
	generation: u64,
	pub(crate) target: ConnectTarget,
	pub(crate) status: LinkStatus,
	/// Frames for the bridge, while the controller socket is open.
	pub(crate) outbound: Option<mpsc::UnboundedSender<String>>,
	task: tokio::task::JoinHandle<()>,
}

impl Drop for Link {
	fn drop(&mut self) {
		self.task.abort();
	}
}

impl Devtools {
	/// Makes `target` the debugger connection, replacing any other. It stays until
	/// [`Self::unlink`] or the next `link_to`; nothing is persisted here.
	pub fn link_to(&self, target: ConnectTarget, name: Option<String>) {
		let generation = self
			.inner
			.next_generation
			.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
			+ 1;
		let replaced = {
			let mut state = self.inner.state.lock();
			// Spawned under the lock, so the task's first update finds this generation in place.
			let task = self.inner.handle.spawn(supervise(
				Arc::downgrade(&self.inner),
				generation,
				target.clone(),
			));
			state.link.replace(Link {
				generation,
				status: LinkStatus {
					name,
					bridge: target.bridge.clone(),
					state: BridgeState::Unknown,
					device: None,
					error: None,
				},
				target,
				outbound: None,
				task,
			})
		};

		if let Some(replaced) = replaced {
			self.inner.detach_backend(replaced.generation);
		}

		self.inner.bump();
	}

	/// Drops the debugger connection and the React DevTools session it carried.
	pub fn unlink(&self) {
		let removed = self.inner.state.lock().link.take();

		if let Some(removed) = removed {
			self.inner.detach_backend(removed.generation);
		}

		self.inner.bump();
	}

	pub(crate) fn link_target(&self) -> Option<ConnectTarget> {
		let state = self.inner.state.lock();
		state.link.as_ref().map(|link| link.target.clone())
	}
}

struct Lost {
	reason: String,
	/// Whether the bridge accepted the socket first; a working bridge resets the backoff.
	attached: bool,
}

async fn supervise(inner: Weak<Inner>, generation: u64, target: ConnectTarget) {
	let mut backoff = MIN_BACKOFF;

	loop {
		let lost = attach(&inner, generation, &target).await;

		if let Some(inner) = inner.upgrade() {
			inner.detach_backend(generation);
			// Dropping the waiters fails each view and explorer request still out with `NotConnected`.
			inner.views.lock().clear();
			inner.explorer.lock().clear();
		}

		let Some(lost) = lost else {
			return;
		};

		if lost.attached {
			backoff = MIN_BACKOFF;
		}

		let updated = update(&inner, generation, |link| {
			link.status.state = BridgeState::Unreachable;
			link.status.device = None;
			link.status.error = Some(lost.reason);
			link.outbound = None;
		});

		if !updated {
			return;
		}

		tokio::time::sleep(backoff).await;
		backoff = (backoff * 2).min(MAX_BACKOFF);
	}
}

/// One controller session. `None` when the link was replaced or the app is gone.
async fn attach(inner: &Weak<Inner>, generation: u64, target: &ConnectTarget) -> Option<Lost> {
	let resolved = tokio::net::lookup_host(target.bridge.to_string())
		.await
		.map(|mut addrs| addrs.next());
	let Ok(Some(address)) = resolved else {
		return Some(Lost {
			reason: format!("cannot resolve the bridge host {}", target.bridge.host()),
			attached: false,
		});
	};
	let mut socket = match bridge::dial(address).await {
		Ok(socket) => socket,
		Err(error) => {
			return Some(Lost {
				reason: error.to_string(),
				attached: false,
			});
		}
	};
	let lost = || {
		Some(Lost {
			reason: "the bridge closed the connection".to_owned(),
			attached: true,
		})
	};
	let (outbound, mut queue) = mpsc::unbounded_channel::<String>();
	let sender = outbound.clone();

	if !update(inner, generation, |link| link.outbound = Some(sender)) {
		return None;
	}

	let mut device_connected = false;

	loop {
		tokio::select! {
			frame = bridge::next_text(&mut socket) => {
				let Some((frame, text)) = frame else {
					return lost();
				};
				let inner = inner.upgrade()?;

				match frame {
					BridgeFrame::DeviceStatus { connected, device } => {
						let updated = update_with(&inner, generation, |link| {
							link.status.state = if connected { BridgeState::DeviceConnected } else { BridgeState::NoDevice };
							link.status.device = device;
							link.status.error = None;
						});
						if !updated {
							return None;
						}
						// A device that connects gets a fresh React DevTools session; its hello
						// repeats `connected`, which keeps the session.
						if connected && !device_connected {
							inner.attach_backend(generation, outbound.clone());
						} else if !connected && device_connected {
							inner.detach_backend(generation);
						}
						device_connected = connected;
					}
					BridgeFrame::ReactDevtools {} => inner.receive(generation, &text),
					BridgeFrame::ViewsResult { id, ok, nodes, total, error } => {
						let reply = if ok {
							Ok(views::ViewReply::Page(views::ViewPage { nodes, total }))
						} else {
							Err(error.unwrap_or_default())
						};
						views::settle(&inner, &id, reply);
					}
					BridgeFrame::ViewDetailsResult { id, ok, details, error } => {
						let reply = match details {
							Some(details) if ok => Ok(views::ViewReply::Details(details)),
							_ => Err(error.unwrap_or_else(|| "The device sent no details.".into())),
						};
						views::settle(&inner, &id, reply);
					}
					frame @ (BridgeFrame::ExplorerObjectResult { .. }
					| BridgeFrame::ExplorerMembersResult { .. }
					| BridgeFrame::ExplorerValuesResult { .. }
					| BridgeFrame::ExplorerClassesResult { .. }) => explorer::settle(&inner, frame),
					BridgeFrame::EvalResult { .. } | BridgeFrame::Other => {}
				}
			}
			Some(text) = queue.recv() => {
				if socket.send(Message::text(text)).await.is_err() {
					return lost();
				}
			}
		}
	}
}

/// Applies `change` while `generation` is still the link. `false` once it was replaced.
fn update(inner: &Weak<Inner>, generation: u64, change: impl FnOnce(&mut Link)) -> bool {
	inner
		.upgrade()
		.is_some_and(|inner| update_with(&inner, generation, change))
}

fn update_with(inner: &Inner, generation: u64, change: impl FnOnce(&mut Link)) -> bool {
	{
		let mut state = inner.state.lock();
		let Some(link) = state
			.link
			.as_mut()
			.filter(|link| link.generation == generation)
		else {
			return false;
		};
		change(link);
	}

	inner.bump();
	true
}
