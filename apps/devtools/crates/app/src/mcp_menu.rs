//! The status bar's MCP button and its menu: copy a command that adds this app's MCP endpoint to an
//! agent's CLI, or the bare URL.

use gpui::{
	Anchor, AnyElement, Context, FontWeight, MouseButton, SharedString, Window, anchored, deferred,
	div, point, prelude::*, px,
};

use crate::app::Workspace;
use crate::widgets::{float_shadow, ghost_button, tooltip};
use crate::{assets, theme};

/// The name each agent registers the server under.
const SERVER_NAME: &str = "unbound-devtools";
const MENU_WIDTH: f32 = 340.;

/// Each menu row: what it is for, and the text it copies.
pub fn copy_choices(url: &str) -> [(&'static str, String); 4] {
	[
		(
			"Claude Code",
			format!("claude mcp add --transport http {SERVER_NAME} {url}"),
		),
		("Codex", format!("codex mcp add {SERVER_NAME} --url {url}")),
		(
			"Gemini CLI",
			format!("gemini mcp add --transport http {SERVER_NAME} {url}"),
		),
		("MCP URL", url.to_owned()),
	]
}

impl Workspace {
	/// The button, and the menu above it while open. `None` when the app serves no MCP endpoint.
	pub fn render_mcp(&self, window: &Window, cx: &mut Context<Self>) -> Option<AnyElement> {
		let url = self.status.mcp_url.clone()?;
		let label = if self.copied { "Copied" } else { "MCP" };
		let button = ghost_button("mcp", assets::COPY, label, true)
			.h(px(28.))
			.when(!self.mcp_menu, |button| {
				button.tooltip(tooltip("Add this app to an agent"))
			})
			.on_click(cx.listener(|this, _, _, cx| {
				this.mcp_menu = !this.mcp_menu;
				cx.notify();
			}));
		Some(
			div()
				.relative()
				.child(button)
				.when(self.mcp_menu, |anchor| {
					anchor.child(self.render_mcp_backdrop(window, cx)).child(
						div().absolute().right_0().top_0().child(
							deferred(
								anchored()
									.anchor(Anchor::BottomRight)
									.offset(point(px(0.), px(-6.)))
									.snap_to_window_with_margin(px(8.))
									.child(self.render_mcp_menu(&url, cx)),
							)
							.with_priority(1),
						),
					)
				})
				.into_any_element(),
		)
	}

	fn render_mcp_backdrop(&self, window: &Window, cx: &mut Context<Self>) -> impl IntoElement {
		let size = window.viewport_size();
		deferred(
			anchored().position(point(px(0.), px(0.))).child(
				div()
					.id("mcp-backdrop")
					.w(size.width)
					.h(size.height)
					.occlude()
					.on_mouse_down(
						MouseButton::Left,
						cx.listener(|this, _, _, cx| {
							this.mcp_menu = false;
							cx.notify();
						}),
					),
			),
		)
	}

	fn render_mcp_menu(&self, url: &str, cx: &mut Context<Self>) -> impl IntoElement {
		let rows = copy_choices(url)
			.into_iter()
			.enumerate()
			.map(|(ix, (title, text))| {
				div()
					.id(("mcp-choice", ix))
					.flex()
					.flex_col()
					.justify_center()
					.h(px(44.))
					.px(px(theme::INSET))
					.rounded(theme::RADIUS_CONTROL)
					.cursor_pointer()
					.hover(|row| row.bg(theme::color(theme::HOVER)))
					.child(
						div()
							.font_weight(FontWeight::MEDIUM)
							.text_color(theme::color(theme::TEXT))
							.child(title),
					)
					.child(
						div()
							.truncate()
							.font_family(theme::mono_font())
							.text_size(theme::TEXT_EYEBROW)
							.text_color(theme::color(theme::TEXT_MUTED))
							.child(SharedString::from(text.clone())),
					)
					.on_click(cx.listener(move |this, _, _, cx| {
						this.mcp_menu = false;
						this.copy_text(text.clone(), cx);
					}))
			});
		div()
			.id("mcp-menu")
			.w(px(MENU_WIDTH))
			.p(px(6.))
			.rounded(theme::RADIUS_SURFACE)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(theme::color(theme::BORDER_STRONG))
			.shadow(float_shadow())
			.font_family(theme::ui_font())
			.text_size(theme::TEXT_UI)
			.occlude()
			.child(
				div()
					.px(px(theme::INSET))
					.pt(px(4.))
					.pb(px(6.))
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(theme::TEXT_MUTED))
					.child("Copy a command that adds this app to an agent"),
			)
			.children(rows)
	}
}

#[cfg(test)]
mod tests {
	use super::copy_choices;

	#[test]
	fn every_choice_carries_the_url() {
		let url = "http://127.0.0.1:8098/mcp";
		let choices = copy_choices(url);
		assert_eq!(
			choices[0].1,
			"claude mcp add --transport http unbound-devtools http://127.0.0.1:8098/mcp"
		);
		assert_eq!(
			choices[1].1,
			"codex mcp add unbound-devtools --url http://127.0.0.1:8098/mcp"
		);
		assert!(choices.iter().all(|(_, text)| text.ends_with(url)));
	}
}
