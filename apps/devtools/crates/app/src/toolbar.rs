//! The top bar: brand, the centered search field, and "Connect device".

use gpui::{Context, Focusable, MouseButton, Window, div, img, prelude::*, px};
use unbound_devtools_core::ConnectionState;

use crate::app::Workspace;
use crate::widgets::{ghost_button, icon, icon_button, tooltip};
use crate::{assets, theme};

/// How the status bar renders the connection: plain text, red only when it needs action.
pub struct Connection {
	pub label: String,
	pub failed: bool,
}

impl Workspace {
	pub fn connection(&self) -> Connection {
		let port = self.config.listen.port();
		let (label, failed) = match &self.status.connection {
			ConnectionState::Connected {
				backend_version, ..
			} => {
				let detail = self.renderer.clone().or_else(|| {
					backend_version
						.as_ref()
						.map(|version| format!("backend {version}"))
				});
				let label = match detail {
					Some(detail) => format!("Connected to {detail}"),
					None => "Connected".to_string(),
				};
				(label, false)
			}
			ConnectionState::Listening { addr } => {
				(format!("Waiting for a device on :{}", addr.port()), false)
			}
			ConnectionState::UnsupportedRenderer { .. } => {
				("Unsupported React renderer".to_string(), true)
			}
			ConnectionState::Failed { error } if error.to_lowercase().contains("in use") => {
				(format!("Port {port} is in use"), true)
			}
			ConnectionState::Failed { .. } => (format!("Can't listen on :{port}"), true),
		};
		Connection { label, failed }
	}

	fn render_search(&self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let focused = self.search_input.focus_handle(cx).is_focused(window);
		let has_text = !self.search_input.read(cx).text().is_empty();
		let search = &self.search;
		let counter = search.is_active().then(|| {
			let current = search.active.map_or(0, |ix| ix + 1);
			format!("{current} of {}", search.matches.len())
		});
		div()
			.key_context("Search")
			.flex()
			.items_center()
			.gap(px(6.))
			.w_full()
			.max_w(px(520.))
			.h(px(28.))
			.pl(px(8.))
			.pr(px(2.))
			.rounded(theme::RADIUS_CONTROL)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(if focused {
				theme::alpha(theme::ACCENT, 0.6)
			} else {
				theme::color(theme::BORDER)
			})
			.child(icon(assets::SEARCH, theme::ICON, theme::TEXT_MUTED))
			.child(self.search_input.clone())
			.when_some(counter, |field, counter| {
				field.child(
					div()
						.flex_none()
						.pr(px(2.))
						.text_size(theme::TEXT_SMALL)
						.text_color(theme::color(theme::TEXT_MUTED))
						.child(counter),
				)
			})
			.when(search.is_active(), |field| {
				field
					.child(
						icon_button("match-prev", assets::CHEVRON_UP, false)
							.size(px(22.))
							.tooltip(tooltip("Previous match  ⇧↵"))
							.on_click(cx.listener(|this, _, _, cx| this.step_match(false, cx))),
					)
					.child(
						icon_button("match-next", assets::CHEVRON_DOWN, false)
							.size(px(22.))
							.tooltip(tooltip("Next match  ↵"))
							.on_click(cx.listener(|this, _, _, cx| this.step_match(true, cx))),
					)
			})
			.when(has_text, |field| {
				field.child(
					icon_button("search-clear", assets::X, false)
						.size(px(22.))
						.tooltip(tooltip("Clear  Esc"))
						.on_click(cx.listener(|this, _, window, cx| this.clear_query(window, cx))),
				)
			})
	}

	pub fn render_toolbar(&self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let connect_label = if self.connecting {
			"Connecting…"
		} else {
			"Connect device"
		};
		let error = self.search.error.clone().or_else(|| self.banner.clone());
		let bar = div()
			.flex_none()
			.h(theme::TOOLBAR_HEIGHT)
			.flex()
			.items_center()
			.gap(px(12.))
			// Equal side padding keeps the search field centered on the window.
			.px(px(4.))
			.bg(theme::color(theme::PANEL))
			.border_b_1()
			.border_color(theme::color(theme::BORDER))
			.child(
				div()
					.flex_1()
					.min_w_0()
					.flex()
					.items_center()
					.gap(px(8.))
					.pl(px(theme::INSET))
					.child(img(assets::LOGO).flex_none().size(px(18.)).rounded(px(4.)))
					.child(
						div()
							.text_color(theme::color(theme::TEXT_SECONDARY))
							.child("Unbound DevTools"),
					),
			)
			.child(
				div()
					.flex_none()
					.w(px(520.))
					.flex()
					.child(self.render_search(window, cx)),
			)
			.child(
				// The inner `pl` mirrors the brand column's padding, so both flex to the same width.
				div()
					.flex_1()
					.min_w_0()
					.pl(px(theme::INSET))
					.flex()
					.justify_end()
					.child(
						ghost_button("connect", assets::PLUG, connect_label)
							.tooltip(tooltip(
								"Ask the device to connect over the debugger bridge",
							))
							.on_click(cx.listener(|this, _, _, cx| this.connect_device(cx))),
					),
			);
		div()
			.flex_none()
			.child(bar)
			.when_some(error, |toolbar, error| {
				toolbar.child(
					div()
						.id("banner")
						.flex()
						.items_center()
						.h(px(28.))
						.px(px(theme::INSET + 4.))
						.bg(theme::alpha(theme::ERROR, 0.08))
						.border_b_1()
						.border_color(theme::alpha(theme::ERROR, 0.25))
						.text_size(theme::TEXT_SMALL)
						.text_color(theme::color(theme::ERROR))
						.child(div().min_w_0().truncate().child(error))
						.on_mouse_down(
							MouseButton::Left,
							cx.listener(|this, _, _, cx| {
								this.banner = None;
								cx.notify();
							}),
						),
				)
			})
	}
}
