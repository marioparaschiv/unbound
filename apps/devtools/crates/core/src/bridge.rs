//! A controller client for the Unbound debugger bridge (`packages/debugger`), mirroring
//! `@unbound-app/debugger-protocol`'s `ControllerClient`: dial `ws://<bridge>/?mcp`, send
//! `{type:"eval", id, code, timeout?}`, match the `eval-result` by id. One short-lived socket per
//! call keeps it stateless.

use std::net::SocketAddr;

#[derive(Debug)]
pub struct EvalOutcome {
	pub ok: bool,
	/// `value` when ok, `error` otherwise.
	pub text: String,
	/// Whether the bridge reported a device on attach (`device-status`).
	pub device_connected: bool,
}

pub async fn eval(bridge: SocketAddr, code: &str, timeout_ms: u64) -> anyhow::Result<EvalOutcome> {
	todo!()
}

/// The device-side script `connect_device` evaluates. With `host == None` it reads the host from
/// the client's `debugger.address` setting (falling back to the build-time address), so the
/// device dials the machine it already reaches. Fails with a readable error when the loader was
/// not started with `loader.devtools` on (no `DevTools` global).
pub fn connect_script(host: Option<&str>, port: u16) -> String {
	todo!()
}
