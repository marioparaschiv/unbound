//! The body before any device has sent a tree.

use gpui::{Context, FontWeight, SharedString, div, img, prelude::*, px};
use unbound_devtools_core::ConnectionState;

use crate::app::Workspace;
use crate::toolbar::{Tone, status_dot};
use crate::widgets::primary_button;
use crate::{assets, theme};

impl Workspace {
	pub fn render_empty(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let (tone, label) = self.connection();
		let (title, body) = match &self.status.connection {
			ConnectionState::Failed { error } => (
				"Can't listen for Discord".to_string(),
				format!(
					"Unbound DevTools could not listen on {}: {error}. Close whatever holds the port or pass --port.",
					self.config.listen
				),
			),
			ConnectionState::UnsupportedRenderer { .. } => (
				"Unsupported React renderer".to_string(),
				"The device attached, but its React renderer is newer than this DevTools backend supports.".to_string(),
			),
			ConnectionState::Listening { addr } => (
				"Waiting for Discord".to_string(),
				format!(
					"Unbound DevTools listens on {addr}. Turn on loader.devtools in Unbound's loader settings and restart Discord, then connect over the debugger bridge."
				),
			),
			ConnectionState::Connected { .. } => (
				"Waiting for the component tree".to_string(),
				"A device is connected. Its React tree appears here as soon as it renders.".to_string(),
			),
		};
		let mcp = self.status.mcp_url.clone().map(|url| {
			div()
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_FAINT))
				.child(format!("Agents can attach at {url}"))
		});
		let card = div()
			.w(px(440.))
			.flex()
			.flex_col()
			.items_center()
			.gap(px(16.))
			.p(px(32.))
			.rounded(theme::RADIUS_CARD)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(theme::color(theme::BORDER))
			.child(img(assets::LOGO).size(px(40.)).rounded(px(10.)))
			.child(
				div()
					.flex()
					.flex_col()
					.items_center()
					.gap(px(8.))
					.child(
						div()
							.text_size(theme::TEXT_HERO)
							.font_weight(FontWeight::SEMIBOLD)
							.child(SharedString::from(title)),
					)
					.child(
						div()
							.flex()
							.items_center()
							.gap(px(6.))
							.text_size(theme::TEXT_SMALL)
							.text_color(theme::color(tone.color()))
							.child(status_dot(tone, "empty-pulse"))
							.child(SharedString::from(label)),
					),
			)
			.child(
				div()
					.text_center()
					.line_height(px(20.))
					.text_color(theme::color(theme::TEXT_SECONDARY))
					.child(SharedString::from(body)),
			)
			.when(tone != Tone::Error, |card| {
				card.child(
					primary_button(
						"connect-empty",
						if self.connecting {
							"Connecting..."
						} else {
							"Connect device"
						},
						self.connecting,
					)
					.on_click(cx.listener(|this, _, _, cx| this.connect_device(cx))),
				)
			})
			.children(mcp);
		div()
			.flex_1()
			.flex()
			.items_center()
			.justify_center()
			.child(card)
	}
}
