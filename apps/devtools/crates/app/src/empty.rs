//! The body before any device has sent a tree.

use gpui::{Context, FontWeight, SharedString, div, img, prelude::*, px};
use unbound_devtools_core::ConnectionState;

use crate::app::Workspace;
use crate::devices::DeviceChoice;
use crate::widgets::primary_button;
use crate::{assets, theme};

impl Workspace {
	pub fn render_empty(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let (title, body, can_connect) = match &self.status.connection {
			ConnectionState::Failed { error } => (
				"Can't listen for Discord",
				format!("{error}. Close whatever holds the port, or start with --port."),
				false,
			),
			ConnectionState::UnsupportedRenderer { .. } => (
				"Unsupported React renderer",
				"The device attached, but its React renderer is newer than this DevTools backend supports."
					.to_string(),
				false,
			),
			ConnectionState::Listening { addr } => (
				"Waiting for Discord",
				format!(
					"Listening on {addr}. Turn on loader.devtools in Unbound's loader settings and restart Discord, then connect over the debugger bridge."
				),
				true,
			),
			ConnectionState::Connected { .. } => (
				"Waiting for the component tree",
				"A device is connected. Its React tree appears here as soon as it renders.".to_string(),
				false,
			),
		};
		let mcp = self.status.mcp_url.clone().map(|url| {
			div()
				.mt(px(8.))
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_FAINT))
				.child(format!("Agents can attach at {url}"))
		});
		let label = match (self.connecting, self.default_choice()) {
			(true, _) => "Connecting".to_owned(),
			(false, DeviceChoice::Default) => "Connect device".to_owned(),
			(false, DeviceChoice::Preset(name)) => format!("Connect {name}"),
		};
		div().flex_1().flex().items_center().justify_center().child(
			div()
				.w(px(400.))
				.flex()
				.flex_col()
				.items_center()
				.gap(px(12.))
				.child(img(assets::LOGO).size(px(40.)).rounded(px(10.)).mb(px(4.)))
				.child(
					div()
						.text_size(theme::TEXT_HERO)
						.font_weight(FontWeight::SEMIBOLD)
						.child(title),
				)
				.child(
					div()
						.text_center()
						.line_height(px(20.))
						.text_color(theme::color(theme::TEXT_SECONDARY))
						.child(SharedString::from(body)),
				)
				.when(can_connect, |column| {
					column.child(
						primary_button("connect-empty", label, self.connecting)
							.mt(px(8.))
							.on_click(cx.listener(|this, _, _, cx| {
								let choice = this.default_choice();
								this.connect(choice, cx);
							})),
					)
				})
				.children(mcp),
		)
	}
}
