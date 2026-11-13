//! The bridge's pairing code under the empty state, so the user can match it against the code
//! Discord's prompt shows. One short line says whether phones can find the bridge; an info icon
//! beside it holds the details on hover.

use gpui::{FontWeight, SharedString, div, prelude::*, px};
use unbound_devtools_core::BridgeInfo;

use crate::theme;
use crate::widgets::{icon, wrapped_tooltip};

const CODE_SIZE: f32 = 32.;
const GLYPH: f32 = 14.;

/// The code, then one line on whether the phone can find this computer, with details on hover.
pub fn pairing(info: &BridgeInfo) -> impl IntoElement {
	let address = info.address.as_deref().map_or_else(
		|| "the address in the top left".to_owned(),
		|address| address.to_owned(),
	);
	let (tone, line, details) = if info.advertising {
		(
			theme::TEXT_MUTED,
			"Discord on the same network will ask to connect",
			format!(
				"Check the code Discord shows matches this one. If it never asks, a firewall or VPN may be blocking mDNS (UDP 5353); type {address} in Unbound's Debugger Address instead."
			),
		)
	} else {
		(
			theme::WARNING,
			"Phones can't find this computer",
			format!(
				"{} Type {address} in Unbound's Debugger Address instead.",
				info.error.as_deref().unwrap_or("mDNS is unavailable.")
			),
		)
	};

	div()
		.mt(px(8.))
		.flex()
		.flex_col()
		.items_center()
		.gap(px(10.))
		.child(
			div()
				.text_size(theme::TEXT_EYEBROW)
				.font_weight(FontWeight::MEDIUM)
				.text_color(theme::color(theme::TEXT_MUTED))
				.child("PAIRING CODE"),
		)
		.child(
			div()
				.font_family(theme::mono_font())
				.text_size(px(CODE_SIZE))
				.font_weight(FontWeight::SEMIBOLD)
				.text_color(theme::color(theme::TEXT))
				.child(SharedString::from(spaced(&info.code))),
		)
		.child(
			div()
				.flex()
				.items_center()
				.gap(px(6.))
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(tone))
				.when(!info.advertising, |row| {
					row.child(icon("icons/triangle-alert.svg", px(GLYPH), tone))
				})
				.child(line)
				.child(
					div()
						.id("pairing-details")
						.flex_none()
						.child(icon("icons/info.svg", px(GLYPH), theme::TEXT_FAINT))
						.tooltip(wrapped_tooltip(details)),
				),
		)
}

/// `4821` as `4 8 2 1`, so each digit reads on its own.
fn spaced(code: &str) -> String {
	code.chars().map(String::from).collect::<Vec<_>>().join(" ")
}
