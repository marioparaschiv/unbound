//! The sidebar's header: a light for whether Discord is connected, what it is connected to, and a
//! copy button for the debugger address. Hovering the button lists every address this machine has.

use std::time::Duration;

use gpui::{
	Anchor, Context, FontWeight, SharedString, Task, Window, anchored, deferred, div, point,
	prelude::*, px,
};
use unbound_devtools_core::{
	BridgeState, ConnectionState, DeviceAddress, DeviceInfo, Devtools, Status,
};

use crate::copy_chip::{copy_chip, natural_width};
use crate::copy_glyph::{copied_state, copy_glyphs, copy_on_click, element_id};
use crate::popout::{Frame, Popout};
use crate::theme::{self, Token};
use crate::widgets::float_shadow;

const CHANGE_COALESCING_FRAME: Duration = Duration::from_millis(16);
/// Long enough to cross the gap between the button and its menu without the menu closing.
const CLOSE_DELAY: Duration = Duration::from_millis(160);
/// Sized so the chips' glyphs sit in one column under the header's copy glyph.
const MENU_WIDTH: f32 = 235.;
const MENU_PADDING: f32 = 6.;
/// The menu hangs this far in from the sidebar's edge, inside the nav rows' inset.
const MENU_LEFT: f32 = theme::INSET;
/// Every chip spans the menu from the text line to the right inset, so their glyphs line up.
const CHIP_WIDTH: f32 = MENU_WIDTH - 2. * (MENU_PADDING + 1. + theme::INSET);
const DOT: f32 = 8.;
const GAP: f32 = 10.;
const ADDRESS_ID: &str = "debugger-address";

pub struct DebuggerLink {
	devtools: Devtools,
	status: Status,
	addresses: Vec<DeviceAddress>,
	/// The pointer is over the copy button, over its menu.
	hovered: (bool, bool),
	menu: Popout,
	closing: Option<Task<()>>,
	_watch: Task<()>,
}

/// The header's light and two lines.
#[derive(Debug, PartialEq, Eq)]
pub struct Indicator {
	pub tone: Token,
	pub title: &'static str,
	pub detail: String,
	/// Whether `detail` is the debugger address, set in the mono font.
	pub address: bool,
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
		Self {
			status: devtools.status(),
			addresses: devtools.device_addresses(),
			devtools,
			hovered: (false, false),
			menu: Popout::default(),
			closing: None,
			_watch: watch,
		}
	}

	fn refresh(&mut self, cx: &mut Context<Self>) {
		self.status = self.devtools.status();
		cx.notify();
	}

	/// Opens the menu while the pointer is on the button or the menu; closes it a moment after it
	/// leaves both.
	fn hover(&mut self, button: Option<bool>, menu: Option<bool>, cx: &mut Context<Self>) {
		self.hovered = (
			button.unwrap_or(self.hovered.0),
			menu.unwrap_or(self.hovered.1),
		);
		if self.hovered.0 || self.hovered.1 {
			self.closing = None;
			if !self.menu.is_open() {
				// Interfaces come and go (VPNs, Wi-Fi); list them as the menu opens.
				self.addresses = self.devtools.device_addresses();
				self.menu.set(true);
				cx.notify();
			}
			return;
		}
		self.closing = Some(cx.spawn(async move |this, cx| {
			cx.background_executor().timer(CLOSE_DELAY).await;
			this.update(cx, |this, cx| {
				this.menu.set(false);
				cx.notify();
			})
			.ok();
		}));
	}

	fn render_copy(&self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let first: SharedString = self
			.addresses
			.first()
			.map(|choice| choice.address.clone())
			.unwrap_or_default()
			.into();
		let state = copied_state(ADDRESS_ID, window, cx);
		let showing = state.read(cx).showing;
		let view = window.current_view();
		div()
			.id(element_id(ADDRESS_ID, "button"))
			.flex_none()
			.size(theme::ICON_BUTTON)
			.flex()
			.items_center()
			.justify_center()
			.rounded(theme::RADIUS_CONTROL)
			.cursor_pointer()
			.when(self.menu.is_open(), |button| {
				button.bg(theme::color(theme::HOVER))
			})
			.hover(|button| button.bg(theme::color(theme::HOVER)))
			.child(copy_glyphs(
				ADDRESS_ID,
				f32::from(theme::ICON),
				theme::TEXT_SECONDARY,
				showing,
			))
			.on_hover(
				cx.listener(|this, hovered: &bool, _, cx| this.hover(Some(*hovered), None, cx)),
			)
			.on_click(copy_on_click(state, view, first))
	}

	/// Each address as a label over a copy chip, both starting on the header's text line. Every
	/// length is drawn at `frame`'s scale, as gpui has no transforms.
	fn render_menu(
		&self,
		frame: Frame,
		window: &Window,
		cx: &mut Context<Self>,
	) -> impl IntoElement {
		// One width for every chip: the column under the header's glyph, or the widest address.
		let s = frame.scale;
		let chip_width = self
			.addresses
			.iter()
			.map(|choice| natural_width(window, &choice.address.clone().into()))
			.fold(CHIP_WIDTH, f32::max);
		let rows = self.addresses.iter().enumerate().map(|(ix, choice)| {
			div()
				.flex()
				.flex_col()
				.items_start()
				.gap(px(6. * s))
				.px(px(theme::INSET * s))
				.py(px(6. * s))
				.child(
					div()
						.text_size(theme::TEXT_SMALL * s)
						.text_color(theme::color(theme::TEXT_MUTED))
						.child(SharedString::from(choice.label.clone())),
				)
				.child(
					copy_chip(format!("{ADDRESS_ID}-{ix}"), choice.address.clone())
						.min_width(chip_width)
						.scale(s),
				)
		});
		div()
			.id("address-menu")
			.min_w(px(MENU_WIDTH * s))
			.p(px(MENU_PADDING * s))
			.rounded(theme::RADIUS_SURFACE * s)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(theme::color(theme::BORDER_STRONG))
			.shadow(float_shadow())
			.opacity(frame.opacity)
			.font_family(theme::ui_font())
			.font_weight(FontWeight::NORMAL)
			.occlude()
			.on_hover(
				cx.listener(|this, hovered: &bool, _, cx| this.hover(None, Some(*hovered), cx)),
			)
			.child(
				div()
					.px(px(theme::INSET * s))
					.pt(px(6. * s))
					.pb(px(2. * s))
					.text_size(theme::TEXT_UI * s)
					.font_weight(FontWeight::MEDIUM)
					.text_color(theme::color(theme::TEXT))
					.child("Debugger Address"),
			)
			.children(rows)
	}
}

impl Render for DebuggerLink {
	fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let first = self.addresses.first().map(|choice| choice.address.as_str());
		let indicator = indicator(&self.status, first.unwrap_or_default());
		let frame = self.menu.frame(window);
		// Shares the page header's height, so the borders meet across the window.
		div()
			.relative()
			.flex_none()
			.h(theme::PAGE_HEADER_HEIGHT)
			.flex()
			.items_center()
			.gap(px(GAP))
			.pl(px(theme::GUTTER))
			// The icon button pads its glyph by 6px, so the header pads 6px less to end on the gutter.
			.pr(px(theme::GUTTER - 6.))
			.border_b_1()
			.border_color(theme::color(theme::BORDER))
			.child(
				div()
					.flex_none()
					.size(px(DOT))
					.rounded_full()
					.bg(theme::color(indicator.tone)),
			)
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
							.text_color(theme::color(theme::TEXT_MUTED))
							.when(indicator.address, |detail| {
								detail.font_family(theme::mono_font())
							})
							.child(SharedString::from(indicator.detail)),
					),
			)
			.child(self.render_copy(window, cx))
			// Hangs from the header rather than the button, so its text starts on the header's line.
			// It grows from Base UI's origin for a start-aligned popup: its left edge at the header's
			// bottom, so the 4px it tucks under the header scales too.
			.when_some(frame, |header, frame| {
				header.child(
					div()
						.absolute()
						.left(px(MENU_LEFT))
						.top(theme::PAGE_HEADER_HEIGHT)
						.child(
							deferred(
								anchored()
									.anchor(Anchor::TopLeft)
									.offset(point(px(0.), px(-4. * frame.scale)))
									.snap_to_window_with_margin(px(8.))
									.child(self.render_menu(frame, window, cx)),
							)
							.with_priority(1),
						),
				)
			})
	}
}

fn device_summary(device: &DeviceInfo) -> String {
	let platform: String = match device.platform.as_str() {
		"ios" => "iOS".to_owned(),
		other => {
			let mut chars = other.chars();
			chars
				.next()
				.map(|first| first.to_uppercase().chain(chars).collect())
				.unwrap_or_default()
		}
	};
	format!("{platform} · Discord {}", device.discord_version)
}

/// What the header says: green once React DevTools is connected, red until then. Until a device
/// connects, the second line is the address Discord should dial.
pub fn indicator(status: &Status, address: &str) -> Indicator {
	let device = status.link.as_ref().and_then(|link| link.device.as_ref());
	let waiting = |title| Indicator {
		tone: theme::ERROR,
		title,
		detail: address.to_owned(),
		address: true,
	};
	let about_device = |tone, title| Indicator {
		tone,
		title,
		detail: device.map(device_summary).unwrap_or_default(),
		address: false,
	};
	match &status.connection {
		ConnectionState::Connected { .. } => about_device(theme::SUCCESS, "Connected"),
		ConnectionState::Unavailable { .. } => about_device(theme::ERROR, "React DevTools Is Off"),
		ConnectionState::UnsupportedRenderer => about_device(theme::ERROR, "Unsupported Renderer"),
		ConnectionState::Waiting => match status.link.as_ref().map(|link| &link.state) {
			Some(BridgeState::Unreachable) => waiting("Debugger Not Running"),
			Some(BridgeState::DeviceConnected) => about_device(theme::ERROR, "Connecting"),
			_ => waiting("Waiting for Discord"),
		},
	}
}

#[cfg(test)]
mod tests {
	use std::time::SystemTime;

	use unbound_devtools_core::LinkStatus;

	use super::*;

	const ADDRESS: &str = "192.168.1.20:9090";

	fn status(connection: ConnectionState, state: BridgeState, device: bool) -> Status {
		Status {
			connection,
			bridge: BridgeState::Unknown,
			link: Some(LinkStatus {
				name: None,
				bridge: "127.0.0.1:9090".parse().expect("bridge"),
				state,
				device: device.then(|| DeviceInfo {
					platform: "android".to_owned(),
					discord_version: "353.1".to_owned(),
					loader_version: "1.0.0".to_owned(),
					client_version: "2.0.0".to_owned(),
				}),
				error: None,
				bridge_info: None,
			}),
			elements: 0,
			roots: 0,
			selected: None,
			show_host_components: false,
			mcp_url: None,
		}
	}

	#[test]
	fn waiting_shows_the_address_in_red() {
		let shown = indicator(
			&status(ConnectionState::Waiting, BridgeState::NoDevice, false),
			ADDRESS,
		);
		assert_eq!(shown.title, "Waiting for Discord");
		assert_eq!(shown.tone, theme::ERROR);
		assert_eq!(shown.detail, ADDRESS);
		assert!(shown.address);
	}

	#[test]
	fn a_stopped_bridge_says_so() {
		let shown = indicator(
			&status(ConnectionState::Waiting, BridgeState::Unreachable, false),
			ADDRESS,
		);
		assert_eq!(shown.title, "Debugger Not Running");
	}

	#[test]
	fn a_connected_backend_is_green_and_names_the_device() {
		let connected = ConnectionState::Connected {
			backend_version: None,
			since: SystemTime::now(),
		};
		let shown = indicator(
			&status(connected, BridgeState::DeviceConnected, true),
			ADDRESS,
		);
		assert_eq!(shown.tone, theme::SUCCESS);
		assert_eq!(shown.detail, "Android · Discord 353.1");
		assert!(!shown.address);
	}
}
