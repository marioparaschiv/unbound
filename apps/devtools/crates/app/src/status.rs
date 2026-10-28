//! The bottom bar: element counts, the MCP endpoint (click to copy), and the bridge state.

use gpui::{Context, div, prelude::*, px};
use unbound_devtools_core::BridgeState;

use crate::app::Workspace;
use crate::theme;
use crate::widgets::dot;

/// Groups thousands: `1284` reads `1,284`.
pub fn thousands(n: usize) -> String {
	let digits = n.to_string();
	let mut out = String::with_capacity(digits.len() + digits.len() / 3);
	for (ix, ch) in digits.chars().enumerate() {
		if ix > 0 && (digits.len() - ix).is_multiple_of(3) {
			out.push(',');
		}
		out.push(ch);
	}
	out
}

fn plural(n: usize, one: &str, many: &str) -> String {
	format!("{} {}", thousands(n), if n == 1 { one } else { many })
}

impl Workspace {
	pub fn render_status(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let status = &self.status;
		let (bridge_color, bridge_label) = match status.bridge {
			BridgeState::Unknown => (theme::TEXT_FAINT, "Bridge"),
			BridgeState::Unreachable => (theme::ERROR, "Bridge unreachable"),
			BridgeState::NoDevice => (theme::WARNING, "Bridge: no device"),
			BridgeState::DeviceConnected => (theme::SUCCESS, "Bridge"),
		};
		let mcp = status.mcp_url.clone().map(|url| {
			let label = if self.copied {
				"Copied".to_string()
			} else {
				format!("MCP {url}")
			};
			div()
				.id("mcp-url")
				.px(px(4.))
				.rounded(px(4.))
				.cursor_pointer()
				.hover(|mcp| {
					mcp.bg(theme::color(theme::HOVER))
						.text_color(theme::color(theme::TEXT))
				})
				.text_color(theme::color(if self.copied {
					theme::SUCCESS
				} else {
					theme::TEXT_SECONDARY
				}))
				.child(label)
				.on_click(cx.listener(|this, _, _, cx| this.copy_mcp_url(cx)))
		});
		div()
			.flex_none()
			.h(theme::STATUS_HEIGHT)
			.flex()
			.items_center()
			.gap(px(12.))
			.px(px(8.))
			.bg(theme::color(theme::PANEL))
			.border_t_1()
			.border_color(theme::color(theme::BORDER))
			.text_size(theme::TEXT_SMALL)
			.text_color(theme::color(theme::TEXT_MUTED))
			.child(div().px(px(4.)).child(format!(
				"{} · {}",
				plural(status.elements, "component", "components"),
				plural(status.roots, "root", "roots"),
			)))
			.child(div().flex_1())
			.children(mcp)
			.child(
				div()
					.flex()
					.items_center()
					.gap(px(6.))
					.px(px(4.))
					.child(dot(bridge_color))
					.child(bridge_label),
			)
	}
}

#[cfg(test)]
mod tests {
	use super::thousands;

	#[test]
	fn groups_thousands() {
		assert_eq!(thousands(0), "0");
		assert_eq!(thousands(999), "999");
		assert_eq!(thousands(1284), "1,284");
		assert_eq!(thousands(1234567), "1,234,567");
	}
}
