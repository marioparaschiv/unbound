use gpui::{Context, SharedString, prelude::*};
use unbound_devtools_core::{BridgeState, ConnectionState};

use crate::app::Workspace;
use crate::empty_state::EmptyState;
use crate::pairing::pairing;
use crate::theme;

/// How to get Discord talking to this app, named as Unbound's settings name them.
pub const SETUP_STEPS: &str = "Turn on Enable Debugger and React DevTools in Unbound's Developer settings, connect your debugger with the address in the top left, then restart Discord.";

impl Workspace {
	pub fn render_empty(&self, _: &mut Context<Self>) -> impl IntoElement {
		let bridge_down = self
			.status
			.link
			.as_ref()
			.is_some_and(|link| matches!(link.state, BridgeState::Unreachable));
		let (icon, tone, title, body): (_, _, _, SharedString) = match &self.status.connection {
			ConnectionState::Unavailable { error } => (
				"icons/power-off.svg",
				theme::WARNING,
				"React DevTools Is Off",
				error.clone().into(),
			),
			ConnectionState::UnsupportedRenderer => (
				"icons/triangle-alert.svg",
				theme::ERROR,
				"Unsupported React Renderer",
				"The device attached, but its React renderer is newer than this DevTools backend supports."
					.into(),
			),
			ConnectionState::Waiting if bridge_down => (
				"icons/unplug.svg",
				theme::ERROR,
				"The Debugger Isn't Running",
				"This app starts the bridge on this machine itself. On another machine, run unbound-devtools serve-bridge there; this app connects as soon as it's up.".into(),
			),
			ConnectionState::Waiting => (
				"icons/smartphone.svg",
				theme::TEXT_FAINT,
				"No Device Connected",
				SETUP_STEPS.into(),
			),
			ConnectionState::Connected { .. } => (
				"icons/component.svg",
				theme::TEXT_FAINT,
				"Waiting for the Component Tree",
				"A device is connected. Its React tree appears here as soon as it renders.".into(),
			),
		};
		// Only while no device is attached: the code is for pairing one.
		let info = self
			.status
			.link
			.as_ref()
			.filter(|link| matches!(link.state, BridgeState::NoDevice))
			.and_then(|link| link.bridge_info.as_ref());

		EmptyState::new(icon, title)
			.tone(tone)
			.body(body)
			.children(info.map(pairing))
	}
}
