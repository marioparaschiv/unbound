use gpui::{Context, prelude::*};
use unbound_devtools_core::{BridgeState, ConnectionState, LinkStatus};

use crate::app::Workspace;
use crate::empty_state::EmptyState;
use crate::pairing::pairing;
use crate::theme;

/// How to get Discord talking to this app, named as Unbound's settings name them.
pub const SETUP_STEPS: &str = "Turn on Enable Debugger and React DevTools in Unbound's Developer settings, connect your debugger with the address in the top left, then restart Discord.";

/// Every page's state while no device is attached: the bridge is down, or it waits for a phone,
/// with the pairing code under while this app's bridge has none.
pub fn no_device(link: Option<&LinkStatus>) -> EmptyState {
	if link.is_some_and(|link| matches!(link.state, BridgeState::Unreachable)) {
		return EmptyState::new("icons/unplug.svg", "The Debugger Isn't Running")
			.tone(theme::ERROR)
			.body("This app starts the bridge on this machine itself. On another machine, run unbound-devtools serve-bridge there; this app connects as soon as it's up.");
	}
	let info = link
		.filter(|link| matches!(link.state, BridgeState::NoDevice))
		.and_then(|link| link.bridge_info.as_ref());
	EmptyState::new("icons/smartphone.svg", "No Device Connected")
		.body(SETUP_STEPS)
		.children(info.map(pairing))
}

impl Workspace {
	pub fn render_empty(&self, _: &mut Context<Self>) -> impl IntoElement {
		match &self.status.connection {
			ConnectionState::Unavailable { error } => {
				EmptyState::new("icons/power-off.svg", "React DevTools Is Off")
					.tone(theme::WARNING)
					.body(error.clone())
			}
			ConnectionState::UnsupportedRenderer => {
				EmptyState::new("icons/triangle-alert.svg", "Unsupported React Renderer")
					.tone(theme::ERROR)
					.body(
						"The device attached, but its React renderer is newer than this DevTools backend supports.",
					)
			}
			ConnectionState::Waiting => no_device(self.status.link.as_ref()),
			ConnectionState::Connected { .. } => {
				EmptyState::new("icons/component.svg", "Waiting for the Component Tree").body(
					"A device is connected. Its React tree appears here as soon as it renders.",
				)
			}
		}
	}
}
