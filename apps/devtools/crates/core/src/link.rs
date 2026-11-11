//! The debugger connection: the one Unbound debugger bridge this app stays attached to. Its
//! supervisor keeps a controller socket open, mirrors the bridge's `device-status`, and asks an
//! attached device to dial this frontend whenever no backend is connected. A lost bridge is
//! redialled with backoff, so a restarted bridge or Discord reconnects on its own.

use std::sync::{Arc, Weak};
use std::time::{Duration, Instant};

use futures_util::SinkExt;
use serde::Serialize;

use crate::bridge::{self, BridgeFrame, DeviceInfo};
use crate::presets::{BridgeAddr, ConnectTarget};
use crate::session::{BridgeState, ConnectionState, Devtools, EVAL_TIMEOUT_MS, Inner};

const MIN_BACKOFF: Duration = Duration::from_secs(1);
const MAX_BACKOFF: Duration = Duration::from_secs(10);
/// How often an attached link checks that a backend is still connected.
const CHECK_EVERY: Duration = Duration::from_secs(2);
/// The least time between two connect scripts, so a device that cannot dial is not flooded.
const REDIAL_AFTER: Duration = Duration::from_secs(10);
const EVAL_GIVE_UP: Duration = Duration::from_millis(EVAL_TIMEOUT_MS + bridge::REPLY_GRACE_MS);

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
	/// Why the device could not connect or the bridge was lost, until the next attempt succeeds.
	pub error: Option<String>,
}

pub(crate) struct Link {
	generation: u64,
	pub(crate) target: ConnectTarget,
	pub(crate) status: LinkStatus,
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
				task,
			})
		};
		drop(replaced);
		self.inner.bump();
	}

	/// Drops the debugger connection. A device already dialling keeps its own retry loop.
	pub fn unlink(&self) {
		let removed = self.inner.state.lock().link.take();
		drop(removed);
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
		let Some(lost) = attach(&inner, generation, &target).await else {
			return;
		};

		if lost.attached {
			backoff = MIN_BACKOFF;
		}

		let updated = update(&inner, generation, |link| {
			link.state = BridgeState::Unreachable;
			link.device = None;
			link.error = Some(lost.reason);
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
	let lost = |reason: &str| {
		Some(Lost {
			reason: reason.to_owned(),
			attached: true,
		})
	};
	let mut check = tokio::time::interval(CHECK_EVERY);
	let mut device_connected = false;
	let mut pending: Option<(String, Instant)> = None;
	let mut last_dial: Option<Instant> = None;

	loop {
		tokio::select! {
			frame = bridge::next_frame(&mut socket) => match frame {
				None => return lost("the bridge closed the connection"),
				Some(BridgeFrame::DeviceStatus { connected, device }) => {
					// A device that just attached is dialled at once, not after the redial pause.
					if connected && !device_connected {
						last_dial = None;
					}
					device_connected = connected;
					let updated = update(inner, generation, |link| {
						link.state = if connected { BridgeState::DeviceConnected } else { BridgeState::NoDevice };
						link.device = device;
						if !connected {
							link.error = None;
						}
					});
					if !updated {
						return None;
					}
				}
				Some(BridgeFrame::EvalResult { id, ok, error, .. })
					if pending.as_ref().is_some_and(|(pending, _)| *pending == id) =>
				{
					pending = None;
					let error = (!ok).then(|| error.unwrap_or_default());
					if !update(inner, generation, |link| link.error = error) {
						return None;
					}
				}
				Some(_) => {}
			},
			_ = check.tick() => {}
		}

		if pending
			.as_ref()
			.is_some_and(|(_, sent)| sent.elapsed() > EVAL_GIVE_UP)
		{
			pending = None;
		}

		let due = last_dial.is_none_or(|sent| sent.elapsed() >= REDIAL_AFTER);

		if !device_connected || pending.is_some() || !due {
			continue;
		}

		let script = {
			let inner = inner.upgrade()?;
			let backend_connected = matches!(
				inner.state.lock().connection,
				ConnectionState::Connected { .. } | ConnectionState::UnsupportedRenderer { .. }
			);

			if backend_connected {
				continue;
			}

			inner.connect_script(target)
		};
		let id = uuid::Uuid::new_v4().to_string();

		if socket
			.send(bridge::eval_request(&id, &script, EVAL_TIMEOUT_MS))
			.await
			.is_err()
		{
			return lost("the bridge closed the connection");
		}

		pending = Some((id, Instant::now()));
		last_dial = Some(Instant::now());
	}
}

/// Applies `change` while `generation` is still the link. `false` once it was replaced.
fn update(inner: &Weak<Inner>, generation: u64, change: impl FnOnce(&mut LinkStatus)) -> bool {
	let Some(inner) = inner.upgrade() else {
		return false;
	};

	{
		let mut state = inner.state.lock();
		let Some(link) = state
			.link
			.as_mut()
			.filter(|link| link.generation == generation)
		else {
			return false;
		};
		change(&mut link.status);
	}

	inner.bump();
	true
}
