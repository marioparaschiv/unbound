use gpui::{Context, MouseButton, div, prelude::*, px};
use gpui_component::input::Input;
use unbound_devtools_core::ConnectionState;

use crate::app::Workspace;
use crate::commands::nav;
use crate::widgets::{field, icon, icon_button, page_header, page_header_end, tooltip};
use crate::{assets, theme};

pub struct Connection {
	pub label: String,
	pub failed: bool,
}

impl Workspace {
	pub fn connection(&self) -> Connection {
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
			// The sidebar header already says what it waits for.
			ConnectionState::Waiting => (String::new(), false),
			ConnectionState::UnsupportedRenderer => {
				("Unsupported React renderer".to_string(), true)
			}
			ConnectionState::Unavailable { .. } => {
				("React DevTools is off on the device".to_string(), true)
			}
		};
		Connection { label, failed }
	}

	fn render_search(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let search = &self.search;
		let counter = search.is_active().then(|| {
			let current = search.active.map_or(0, |ix| ix + 1);
			format!("{current} of {}", search.matches.len())
		});
		let suffix = div()
			.flex()
			.items_center()
			.gap(px(2.))
			.when_some(counter, |suffix, counter| {
				suffix.child(
					div()
						.flex_none()
						.pr(px(4.))
						.text_size(theme::TEXT_SMALL)
						.text_color(theme::color(theme::TEXT_MUTED))
						.child(counter),
				)
			})
			.when(search.is_active(), |suffix| {
				suffix
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
			});
		// Fixed in the header's centre column; it gives way before the breadcrumb does.
		div()
			.key_context("Search")
			.flex_shrink(1.)
			.min_w(px(240.))
			.w(px(480.))
			.child(field(
				Input::new(&self.search_input)
					.prefix(icon(assets::SEARCH, theme::ICON, theme::TEXT_MUTED))
					.suffix(suffix)
					.cleanable(true),
			))
	}

	pub fn render_toolbar(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let error = self.search.error.clone().or_else(|| self.banner.clone());
		let bar = page_header(nav::COMPONENTS_GROUP, "Components")
			.child(self.render_search(cx))
			.child(page_header_end());
		div()
			.flex_none()
			.child(bar)
			.when_some(error, |toolbar, error| {
				toolbar.child(
					div()
						.id("banner")
						.flex()
						.items_center()
						.h(px(30.))
						.px(px(theme::GUTTER))
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
