//! The top bar: brand, search field, connection pill, host toggle, and "Connect device".

use std::time::Duration;

use gpui::{
	Animation, AnimationExt, Context, Focusable, MouseButton, SharedString, Window, bounce, div,
	ease_in_out, img, prelude::*, px, svg,
};
use unbound_devtools_core::ConnectionState;

use crate::app::Workspace;
use crate::widgets::{button, dot, primary_button};
use crate::{assets, theme};

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Tone {
	Success,
	Waiting,
	Error,
}

impl Tone {
	pub fn color(self) -> u32 {
		match self {
			Tone::Success => theme::SUCCESS,
			Tone::Waiting => theme::WARNING,
			Tone::Error => theme::ERROR,
		}
	}
}

/// A status dot; the waiting one breathes so it reads as "still trying".
pub fn status_dot(tone: Tone, id: &'static str) -> impl IntoElement {
	let dot = dot(tone.color());
	if tone != Tone::Waiting {
		return dot.into_any_element();
	}
	dot.with_animation(
		id,
		Animation::new(Duration::from_millis(1400))
			.repeat()
			.with_easing(bounce(ease_in_out)),
		|dot, t| dot.opacity(0.35 + 0.65 * t),
	)
	.into_any_element()
}

fn icon(path: &'static str, color: u32) -> impl IntoElement {
	svg()
		.path(path)
		.flex_none()
		.size(px(14.))
		.text_color(theme::color(color))
}

impl Workspace {
	pub fn connection(&self) -> (Tone, String) {
		let port = self.config.listen.port();
		match &self.status.connection {
			ConnectionState::Connected {
				backend_version, ..
			} => {
				let detail = self.renderer.clone().or_else(|| {
					backend_version
						.as_ref()
						.map(|version| format!("backend {version}"))
				});
				let label = match detail {
					Some(detail) => format!("Connected · {detail}"),
					None => "Connected".to_string(),
				};
				(Tone::Success, label)
			}
			ConnectionState::Listening { addr } => {
				(Tone::Waiting, format!("Waiting on :{}", addr.port()))
			}
			ConnectionState::UnsupportedRenderer { .. } => {
				(Tone::Error, "Unsupported renderer".to_string())
			}
			ConnectionState::Failed { error } if error.to_lowercase().contains("in use") => {
				(Tone::Error, format!("Port {port} in use"))
			}
			ConnectionState::Failed { .. } => (Tone::Error, format!("Can't listen on :{port}")),
		}
	}

	fn render_search(&self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let focused = self.search_input.focus_handle(cx).is_focused(window);
		let search = &self.search;
		let counter = search.is_active().then(|| {
			let current = search.active.map_or(0, |ix| ix + 1);
			format!("{current} / {}", search.matches.len())
		});
		let step = |id: &'static str, path: &'static str, forward: bool| {
			div()
				.id(id)
				.flex_none()
				.size(px(20.))
				.flex()
				.items_center()
				.justify_center()
				.rounded(px(4.))
				.cursor_pointer()
				.hover(|step| step.bg(theme::color(theme::HOVER)))
				.child(icon(path, theme::TEXT_SECONDARY))
				.on_click(cx.listener(move |this, _, _, cx| this.step_match(forward, cx)))
		};
		div()
			.key_context("Search")
			.flex()
			.items_center()
			.gap(px(8.))
			.w_full()
			.max_w(px(560.))
			.h(px(30.))
			.pl(px(10.))
			.pr(px(4.))
			.rounded(theme::RADIUS_CARD)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(if focused {
				theme::alpha(theme::ACCENT, 0.55)
			} else {
				theme::color(theme::BORDER)
			})
			.child(icon(assets::SEARCH, theme::TEXT_MUTED))
			.child(self.search_input.clone())
			.when_some(counter, |field, counter| {
				field
					.child(
						div()
							.flex_none()
							.text_size(theme::TEXT_SMALL)
							.text_color(theme::color(theme::TEXT_MUTED))
							.child(counter),
					)
					.child(
						div()
							.flex()
							.child(step("match-prev", assets::CHEVRON_UP, false))
							.child(step("match-next", assets::CHEVRON_DOWN, true)),
					)
			})
	}

	pub fn render_toolbar(&self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let (tone, label) = self.connection();
		let show_host = self.status.show_host_components;
		let connect_label = if self.connecting {
			"Connecting..."
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
			.px(px(12.))
			.bg(theme::color(theme::PANEL))
			.border_b_1()
			.border_color(theme::color(theme::BORDER))
			.child(
				div()
					.flex_none()
					.flex()
					.items_center()
					.gap(px(8.))
					.child(img(assets::LOGO).size(px(20.)).rounded(px(5.)))
					.child(
						div()
							.text_color(theme::color(theme::TEXT_SECONDARY))
							.child("DevTools"),
					),
			)
			.child(
				div()
					.flex_1()
					.min_w_0()
					.flex()
					.justify_center()
					.child(self.render_search(window, cx)),
			)
			.child(
				div()
					.flex_none()
					.flex()
					.items_center()
					.justify_end()
					.gap(px(8.))
					.child(
						div()
							.flex()
							.items_center()
							.gap(px(6.))
							.max_w(px(320.))
							.h(px(24.))
							.px(px(8.))
							.rounded(theme::RADIUS_PILL)
							.bg(theme::color(theme::ELEVATED))
							.border_1()
							.border_color(theme::color(theme::BORDER))
							.text_size(theme::TEXT_SMALL)
							.text_color(theme::color(theme::TEXT_SECONDARY))
							.child(status_dot(tone, "connection-pulse"))
							.child(div().min_w_0().truncate().child(SharedString::from(label))),
					)
					.child(button("host", "Host", show_host).on_click(
						cx.listener(move |this, _, _, _| this.set_show_host_components(!show_host)),
					))
					.child(
						primary_button("connect", connect_label, self.connecting)
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
						.h(px(24.))
						.px(px(12.))
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
