use gpui::{Context, div, prelude::*, px};

use crate::app::Workspace;
use crate::widgets::{footer_bar, ghost_button, tooltip};
use crate::{assets, theme};

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
		let counts = (status.elements > 0).then(|| {
			[
				plural(status.elements, "component", "components"),
				plural(status.roots, "root", "roots"),
			]
		});
		let mcp = status.mcp_url.clone().map(|url| {
			let label = if self.copied {
				"Copied".to_string()
			} else {
				format!("MCP  {}", url.trim_start_matches("http://"))
			};
			ghost_button("mcp-url", assets::COPY, label, true)
				.h(px(28.))
				.tooltip(tooltip("Copy the MCP endpoint for an agent"))
				.on_click(cx.listener(|this, _, _, cx| this.copy_mcp_url(cx)))
		});
		// The ghost button pads its label by 8px, so the bar pads 8px less to end on the gutter.
		footer_bar()
			.pl(px(theme::GUTTER))
			.pr(px(theme::GUTTER - 8.))
			.child(
				div()
					.min_w_0()
					.truncate()
					.when(connection.failed, |text| {
						text.text_color(theme::color(theme::ERROR))
					})
					.child(connection.label),
			)
			.child(div().flex_1())
			.children(
				counts
					.into_iter()
					.flatten()
					.map(|count| div().flex_none().child(count)),
			)
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
