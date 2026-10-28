//! The bottom bar: connection state, element counts, and the MCP endpoint (click to copy).

use gpui::{Context, div, prelude::*, px};
use unbound_devtools_core::BridgeState;

use crate::app::Workspace;
use crate::widgets::{ghost_button, tooltip};
use crate::{assets, theme};

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
		let connection = self.connection();
		let bridge = match status.bridge {
			BridgeState::Unreachable => Some("Bridge unreachable"),
			BridgeState::NoDevice => Some("Bridge has no device"),
			BridgeState::Unknown | BridgeState::DeviceConnected => None,
		};
		let counts = (status.elements > 0).then(|| {
			format!(
				"{} · {}",
				plural(status.elements, "component", "components"),
				plural(status.roots, "root", "roots"),
			)
		});
		let mcp = status.mcp_url.clone().map(|url| {
			let label = if self.copied {
				"Copied".to_string()
			} else {
				format!("MCP  {}", url.trim_start_matches("http://"))
			};
			ghost_button("mcp-url", assets::COPY, label)
				.h(px(22.))
				.tooltip(tooltip("Copy the MCP endpoint for an agent"))
				.on_click(cx.listener(|this, _, _, cx| this.copy_mcp_url(cx)))
		});
		div()
			.flex_none()
			.h(theme::STATUS_HEIGHT)
			.flex()
			.items_center()
			.gap(px(12.))
			.pl(px(theme::INSET + 4.))
			.pr(px(theme::INSET - 4.))
			.bg(theme::color(theme::PANEL))
			.border_t_1()
			.border_color(theme::color(theme::BORDER))
			.text_size(theme::TEXT_SMALL)
			.text_color(theme::color(theme::TEXT_MUTED))
			.child(
				div()
					.min_w_0()
					.truncate()
					.when(connection.failed, |text| {
						text.text_color(theme::color(theme::ERROR))
					})
					.child(connection.label),
			)
			.children(bridge.map(|bridge| div().flex_none().child(bridge)))
			.child(div().flex_1())
			.children(counts.map(|counts| div().flex_none().child(counts)))
			.children(mcp)
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
