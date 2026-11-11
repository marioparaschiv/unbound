//! The debugger connection's banner along the bottom of the sidebar: an always-visible light for
//! whether a device is connected, and the menu that picks, saves or drops the device.

use std::time::Duration;

use gpui::{
	Anchor, Context, Div, FontWeight, SharedString, Task, Window, anchored, deferred, div, point,
	prelude::*, px,
};
use unbound_devtools_core::{
	BridgeAddr, BridgeState, ConnectionState, DeviceInfo, Devtools, LinkStatus, Presets, Status,
};

use crate::assets;
use crate::devices::DeviceMenu;
use crate::theme::{self, Token};
use crate::widgets::icon;

const CHANGE_COALESCING_FRAME: Duration = Duration::from_millis(16);

pub struct DebuggerLink {
	pub devtools: Devtools,
	pub status: Status,
	pub presets: Result<Presets, String>,
	pub presets_revision: u64,
	pub device_menu: Option<DeviceMenu>,
	/// Why the last menu action failed, shown at the top of the menu.
	pub error: Option<String>,
	_watch: Task<()>,
}

/// The banner's light and two lines.
#[derive(Debug, PartialEq, Eq)]
pub struct Indicator {
	pub tone: Token,
	pub title: &'static str,
	pub detail: String,
	/// Whether `detail` is a failure, drawn in the error colour.
	pub failed: bool,
}

impl DebuggerLink {
	pub fn new(devtools: Devtools, cx: &mut Context<Self>) -> Self {
		let watch = cx.spawn({
			let mut changes = devtools.changes();
			async move |this, cx| {
				while changes.changed().await.is_ok() {
					changes.borrow_and_update();
					if this.update(cx, |this, cx| this.refresh(cx)).is_err() {
						break;
					}
					cx.background_executor()
						.timer(CHANGE_COALESCING_FRAME)
						.await;
				}
			}
		});
		let mut this = Self {
			status: devtools.status(),
			devtools,
			presets: Ok(Presets::default()),
			presets_revision: 0,
			device_menu: None,
			error: None,
			_watch: watch,
		};
		this.reload_presets();
		this
	}

	fn refresh(&mut self, cx: &mut Context<Self>) {
		self.status = self.devtools.status();
		if self.presets_revision != self.devtools.presets_revision() {
			self.reload_presets();
		}
		cx.notify();
	}

	fn render_banner(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let open = self.device_menu.is_some();
		let indicator = indicator(&self.status, &self.devtools.default_target().bridge);
		div()
			.id("debugger-link")
			.h_full()
			.flex()
			.items_center()
			.gap(px(10.))
			.px(px(theme::GUTTER))
			.cursor_pointer()
			.when(open, |banner| banner.bg(theme::color(theme::HOVER)))
			.hover(|banner| banner.bg(theme::color(theme::HOVER)))
			.child(light(indicator.tone))
			.child(
				div()
					.flex_1()
					.min_w_0()
					.flex()
					.flex_col()
					.child(
						div()
							.truncate()
							.text_size(theme::TEXT_UI)
							.line_height(px(18.))
							.font_weight(FontWeight::MEDIUM)
							.text_color(theme::color(theme::TEXT))
							.child(indicator.title),
					)
					.child(
						div()
							.truncate()
							.text_size(theme::TEXT_SMALL)
							.line_height(px(16.))
							.text_color(theme::color(if indicator.failed {
								theme::ERROR
							} else {
								theme::TEXT_MUTED
							}))
							.child(SharedString::from(indicator.detail)),
					),
			)
			.child(icon(
				if open {
					assets::CHEVRON_DOWN
				} else {
					assets::CHEVRON_UP
				},
				theme::ICON,
				theme::TEXT_MUTED,
			))
			.on_click(cx.listener(|this, _, window, cx| this.toggle_device_menu(window, cx)))
	}
}

impl Render for DebuggerLink {
	fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		// The banner meets the pages' footers in one line: same height, same top border.
		div()
			.relative()
			.flex_none()
			.h(theme::FOOTER_HEIGHT)
			.border_t_1()
			.border_color(theme::color(theme::BORDER))
			.child(self.render_banner(cx))
			.when(self.device_menu.is_some(), |banner| {
				banner.child(
					div().absolute().left_0().top_0().child(
						deferred(
							anchored()
								.anchor(Anchor::BottomLeft)
								.offset(point(px(theme::INSET), px(-4.)))
								.snap_to_window_with_margin(px(8.))
								.child(self.render_device_menu(cx)),
						)
						.with_priority(1),
					),
				)
			})
			.children(self.render_menu_backdrop(window, cx))
	}
}

/// A solid dot in a soft halo of the same tone.
fn light(tone: Token) -> Div {
	div()
		.flex_none()
		.size(px(16.))
		.flex()
		.items_center()
		.justify_center()
		.rounded_full()
		.bg(theme::alpha(tone, 0.18))
		.child(div().size(px(8.)).rounded_full().bg(theme::color(tone)))
}

fn device_summary(device: &DeviceInfo) -> String {
	format!("{} · Discord {}", device.platform, device.discord_version)
}

/// The link's device name: a preset, "This Machine" for the app's own bridge, else the address.
fn link_label(link: &LinkStatus, default_bridge: &BridgeAddr) -> String {
	match &link.name {
		Some(name) => name.clone(),
		None if link.bridge == *default_bridge => "This Machine".to_owned(),
		None => link.bridge.to_string(),
	}
}

/// What the banner says. A connected backend wins over the link: a device may dial on its own.
pub fn indicator(status: &Status, default_bridge: &BridgeAddr) -> Indicator {
	let link = status.link.as_ref();
	let label = link.map(|link| link_label(link, default_bridge));
	let say = |tone, title, detail: String, failed| Indicator {
		tone,
		title,
		detail,
		failed,
	};
	match &status.connection {
		ConnectionState::Failed { error } => {
			let detail = if error.contains("in use") {
				"The DevTools port is in use".to_owned()
			} else {
				error.clone()
			};
			say(theme::ERROR, "Can't Listen", detail, true)
		}
		ConnectionState::UnsupportedRenderer { peer } => say(
			theme::ERROR,
			"Unsupported Renderer",
			peer.ip().to_string(),
			true,
		),
		ConnectionState::Connected { peer, .. } => {
			let device = link.and_then(|link| link.device.as_ref());
			let detail = match (label, device) {
				(Some(label), Some(device)) => format!("{label} · {}", device_summary(device)),
				(Some(label), None) => label,
				(None, _) => peer.ip().to_string(),
			};
			say(theme::SUCCESS, "Connected", detail, false)
		}
		ConnectionState::Listening { .. } => {
			let (Some(link), Some(label)) = (link, label) else {
				return say(
					theme::TEXT_FAINT,
					"Not Connected",
					"Choose a device".to_owned(),
					false,
				);
			};
			match (&link.state, &link.error) {
				(BridgeState::Unreachable, _) => say(
					theme::ERROR,
					"Bridge Unreachable",
					format!("Retrying {}", link.bridge),
					true,
				),
				(BridgeState::DeviceConnected, Some(error)) => {
					say(theme::ERROR, "Can't Connect", error.clone(), true)
				}
				(BridgeState::NoDevice, _) => {
					say(theme::WARNING, "Waiting for Discord", label, false)
				}
				(BridgeState::DeviceConnected, None) => {
					let detail = link.device.as_ref().map_or(label, device_summary);
					say(theme::WARNING, "Connecting", detail, false)
				}
				(BridgeState::Unknown, _) => say(theme::WARNING, "Connecting", label, false),
			}
		}
	}
}

#[cfg(test)]
mod tests {
	use std::net::SocketAddr;
	use std::time::SystemTime;

	use super::*;

	fn status(connection: ConnectionState, link: Option<LinkStatus>) -> Status {
		Status {
			connection,
			bridge: BridgeState::Unknown,
			link,
			elements: 0,
			roots: 0,
			selected: None,
			show_host_components: false,
			mcp_url: None,
		}
	}

	fn listening() -> ConnectionState {
		ConnectionState::Listening {
			addr: "0.0.0.0:8097".parse().expect("addr"),
		}
	}

	fn link(state: BridgeState, error: Option<&str>) -> LinkStatus {
		LinkStatus {
			name: Some("iPhone VM".to_owned()),
			bridge: "100.64.0.2:9090".parse().expect("bridge"),
			state,
			device: None,
			error: error.map(str::to_owned),
		}
	}

	fn bridge() -> BridgeAddr {
		"127.0.0.1:9090".parse().expect("bridge")
	}

	#[test]
	fn no_link_is_not_connected() {
		let shown = indicator(&status(listening(), None), &bridge());
		assert_eq!(shown.title, "Not Connected");
		assert_eq!(shown.tone, theme::TEXT_FAINT);
	}

	#[test]
	fn a_link_reports_each_bridge_state() {
		let title = |state, error| {
			indicator(&status(listening(), Some(link(state, error))), &bridge()).title
		};
		assert_eq!(title(BridgeState::Unknown, None), "Connecting");
		assert_eq!(
			title(BridgeState::Unreachable, Some("refused")),
			"Bridge Unreachable"
		);
		assert_eq!(title(BridgeState::NoDevice, None), "Waiting for Discord");
		assert_eq!(title(BridgeState::DeviceConnected, None), "Connecting");
		assert_eq!(
			title(BridgeState::DeviceConnected, Some("not loaded")),
			"Can't Connect"
		);
	}

	#[test]
	fn a_connected_backend_is_green_and_names_the_device() {
		let peer: SocketAddr = "100.64.0.2:50000".parse().expect("peer");
		let connected = ConnectionState::Connected {
			peer,
			backend_version: None,
			since: SystemTime::now(),
		};
		let shown = indicator(
			&status(connected, Some(link(BridgeState::DeviceConnected, None))),
			&bridge(),
		);
		assert_eq!(shown.tone, theme::SUCCESS);
		assert_eq!(shown.detail, "iPhone VM");
	}

	#[test]
	fn the_apps_own_bridge_is_this_machine() {
		let mut own = link(BridgeState::Unknown, None);
		own.name = None;
		own.bridge = bridge();
		let shown = indicator(&status(listening(), Some(own)), &bridge());
		assert_eq!(shown.detail, "This Machine");
	}
}
