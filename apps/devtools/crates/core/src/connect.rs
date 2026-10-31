use std::net::SocketAddr;
use std::sync::atomic::Ordering;

use crate::bridge;
use crate::presets::{ConnectTarget, DevicePreset, PresetError, PresetFile, Presets};
use crate::session::{BridgeState, Devtools, EVAL_TIMEOUT_MS};

impl Devtools {
	/// The bridge and dial-back host from the command line: "This machine" in the GUI.
	pub fn default_target(&self) -> ConnectTarget {
		ConnectTarget {
			bridge: self.inner.config.bridge.into(),
			advertise_host: self.inner.config.advertise_host.clone(),
		}
	}

	/// Asks the device on the command line's bridge to dial this frontend, and makes that the
	/// default again for the GUI's main button.
	pub async fn connect_device(&self) -> anyhow::Result<String> {
		let url = self.connect_device_to(self.default_target()).await?;
		self.remember(None);
		Ok(url)
	}

	/// Dials a saved device and remembers it as the main button's target.
	pub async fn connect_preset(&self, name: &str) -> anyhow::Result<String> {
		let preset = self
			.presets()?
			.get(name)
			.cloned()
			.ok_or_else(|| PresetError::NotFound(name.to_owned()))?;
		let url = self.connect_device_to(preset.target()).await?;
		self.remember(Some(preset.name));
		Ok(url)
	}

	/// Asks the device behind `target.bridge`, over the Unbound debugger bridge, to dial this
	/// frontend (`DevTools.connect`). Returns the address the device was told to dial.
	pub async fn connect_device_to(&self, target: ConnectTarget) -> anyhow::Result<String> {
		let port = {
			let state = self.inner.state.lock();
			state
				.listen_addr
				.map_or(self.inner.config.listen.port(), |addr| addr.port())
		};
		let script = bridge::connect_script(target.advertise_host.as_deref(), port);
		let name = target.bridge.to_string();
		let resolved = self
			.on_runtime(async move {
				tokio::net::lookup_host(name)
					.await
					.map(|mut addrs| addrs.next())
			})
			.await
			.map_err(|error| anyhow::anyhow!("bridge task failed: {error}"))?;
		let address = match resolved {
			Ok(Some(address)) => address,
			Ok(None) | Err(_) => {
				self.inner.state.lock().bridge = BridgeState::Unreachable;
				self.inner.bump();
				anyhow::bail!("cannot resolve the bridge host {}", target.bridge.host());
			}
		};

		self.eval_at(address, &script).await
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

	pub fn remove_preset(&self, name: &str) -> Result<DevicePreset, PresetError> {
		self.update_presets(|presets| presets.remove(name))
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

	fn remember(&self, last_used: Option<String>) {
		let remembered = self.update_presets(|presets| {
			presets.last_used = last_used;
			Ok(())
		});

		if let Err(error) = remembered {
			tracing::warn!("could not remember the last device: {error}");
		}
	}

	/// Evaluates JavaScript on device over the command line's bridge. Pairs with
	/// [`Self::store_as_global`].
	pub async fn eval(&self, code: &str) -> anyhow::Result<String> {
		self.eval_at(self.inner.config.bridge, code).await
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
