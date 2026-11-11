use std::net::SocketAddr;
use std::sync::atomic::Ordering;

use crate::bridge;
use crate::presets::{ConnectTarget, DevicePreset, PresetError, PresetFile, Presets};
use crate::session::{BridgeState, Devtools, EVAL_TIMEOUT_MS, Inner};

impl Inner {
	/// The script that asks a device to dial this frontend, as `target` says to reach it.
	pub(crate) fn connect_script(&self, target: &ConnectTarget) -> String {
		let port = self
			.state
			.lock()
			.listen_addr
			.map_or(self.config.listen.port(), |addr| addr.port());

		bridge::connect_script(target.advertise_host.as_deref(), port)
	}
}

impl Devtools {
	/// The bridge and dial-back host from the command line: "This machine" in the GUI.
	pub fn default_target(&self) -> ConnectTarget {
		ConnectTarget {
			bridge: self.inner.config.bridge.into(),
			advertise_host: self.inner.config.advertise_host.clone(),
		}
	}

	/// Asks the device on the command line's bridge to dial this frontend now, then keeps it as the
	/// debugger connection.
	pub async fn connect_device(&self) -> anyhow::Result<String> {
		let url = self.connect_device_to(self.default_target()).await;
		self.connect_link(None)?;
		url
	}

	/// Dials a saved device now, then keeps it as the debugger connection.
	pub async fn connect_preset(&self, name: &str) -> anyhow::Result<String> {
		let preset = self
			.presets()?
			.get(name)
			.cloned()
			.ok_or_else(|| PresetError::NotFound(name.to_owned()))?;
		let url = self.connect_device_to(preset.target()).await;
		self.connect_link(Some(&preset.name))?;
		url
	}

	/// Makes a saved device (or this machine's bridge, `None`) the debugger connection, and turns
	/// it on at the next launch too.
	pub fn connect_link(&self, preset: Option<&str>) -> Result<(), PresetError> {
		let (target, name) = match preset {
			Some(name) => {
				let preset = self
					.presets()?
					.get(name)
					.cloned()
					.ok_or_else(|| PresetError::NotFound(name.to_owned()))?;
				(preset.target(), Some(preset.name))
			}
			None => (self.default_target(), None),
		};
		self.link_to(target, name.clone());
		self.remember(|presets| {
			presets.last_used = name;
			presets.auto_connect = true;
		});
		Ok(())
	}

	/// Drops the debugger connection and keeps it off at the next launch.
	pub fn disconnect_link(&self) {
		self.unlink();
		self.remember(|presets| presets.auto_connect = false);
	}

	/// Restores the debugger connection the last session left on.
	pub fn resume_link(&self) {
		let presets = match self.presets() {
			Ok(presets) => presets,
			Err(error) => {
				tracing::warn!("Failed to read the saved devices: {error}");
				return;
			}
		};

		if !presets.auto_connect {
			return;
		}

		match presets.last_used() {
			Some(preset) => self.link_to(preset.target(), Some(preset.name.clone())),
			None => self.link_to(self.default_target(), None),
		}
	}

	/// Asks the device behind `target.bridge`, over the Unbound debugger bridge, to dial this
	/// frontend (`DevTools.connect`). Returns the address the device was told to dial.
	pub async fn connect_device_to(&self, target: ConnectTarget) -> anyhow::Result<String> {
		let script = self.inner.connect_script(&target);
		let address = self.resolve(&target).await?;

		self.eval_at(address, &script).await
	}

	async fn resolve(&self, target: &ConnectTarget) -> anyhow::Result<SocketAddr> {
		let name = target.bridge.to_string();
		let resolved = self
			.on_runtime(async move {
				tokio::net::lookup_host(name)
					.await
					.map(|mut addrs| addrs.next())
			})
			.await
			.map_err(|error| anyhow::anyhow!("bridge task failed: {error}"))?;

		if let Ok(Some(address)) = resolved {
			return Ok(address);
		}

		self.inner.state.lock().bridge = BridgeState::Unreachable;
		self.inner.bump();
		anyhow::bail!("cannot resolve the bridge host {}", target.bridge.host());
	}

	/// The saved devices, read from disk so a second app instance's edits show up.
	pub fn presets(&self) -> Result<Presets, PresetError> {
		PresetFile::locate()?.load()
	}

	/// Bumped whenever this process changes the saved devices, so the GUI knows to reload them.
	pub fn presets_revision(&self) -> u64 {
		self.inner.presets_revision.load(Ordering::Relaxed)
	}

	pub fn save_preset(&self, preset: DevicePreset) -> Result<(), PresetError> {
		self.update_presets(|presets| presets.insert(preset))
	}

	/// Removing the linked device drops the debugger connection with it.
	pub fn remove_preset(&self, name: &str) -> Result<DevicePreset, PresetError> {
		let removed = self.update_presets(|presets| presets.remove(name))?;
		let linked = {
			let state = self.inner.state.lock();
			state
				.link
				.as_ref()
				.is_some_and(|link| link.status.name.as_deref() == Some(removed.name.as_str()))
		};

		if linked {
			self.unlink();
		}

		Ok(removed)
	}

	fn update_presets<T>(
		&self,
		change: impl FnOnce(&mut Presets) -> Result<T, PresetError>,
	) -> Result<T, PresetError> {
		let out = {
			let _writing = self.inner.presets_write.lock();
			PresetFile::locate()?.update(change)?
		};
		self.inner.presets_revision.fetch_add(1, Ordering::Relaxed);
		self.inner.bump();
		Ok(out)
	}

	fn remember(&self, change: impl FnOnce(&mut Presets)) {
		let remembered = self.update_presets(|presets| {
			change(presets);
			Ok(())
		});

		if let Err(error) = remembered {
			tracing::warn!("Failed to remember the debugger connection: {error}");
		}
	}

	/// Evaluates JavaScript on device over the debugger connection's bridge, or the command line's
	/// when there is none. Pairs with [`Self::store_as_global`].
	pub async fn eval(&self, code: &str) -> anyhow::Result<String> {
		let target = self.link_target().unwrap_or_else(|| self.default_target());
		let address = self.resolve(&target).await?;

		self.eval_at(address, code).await
	}

	async fn eval_at(&self, address: SocketAddr, code: &str) -> anyhow::Result<String> {
		let code = code.to_owned();
		let outcome = self
			.on_runtime(async move { bridge::eval(address, &code, EVAL_TIMEOUT_MS).await })
			.await
			.map_err(|error| anyhow::anyhow!("bridge task failed: {error}"))?;

		let bridge_state = match &outcome {
			Err(_) => BridgeState::Unreachable,
			Ok(outcome) if outcome.device_connected => BridgeState::DeviceConnected,
			Ok(_) => BridgeState::NoDevice,
		};
		self.inner.state.lock().bridge = bridge_state;
		self.inner.bump();

		let outcome = outcome?;

		if !outcome.ok {
			anyhow::bail!("{}", outcome.text);
		}

		Ok(outcome.text)
	}
}
