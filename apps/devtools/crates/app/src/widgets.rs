//! Small styled building blocks shared by the views.

use gpui::{Div, FontWeight, SharedString, Stateful, div, prelude::*, px};

use crate::theme;

/// A rounded label: kind badges, HOC names, counts.
pub fn pill(text: impl Into<SharedString>, fg: u32, bg: gpui::Rgba) -> Div {
	div()
		.flex_none()
		.px(px(6.))
		.h(px(16.))
		.flex()
		.items_center()
		.rounded(theme::RADIUS_PILL)
		.bg(bg)
		.text_color(theme::color(fg))
		.text_size(px(10.5))
		.child(text.into())
}

pub fn dot(color: u32) -> Div {
	div()
		.flex_none()
		.size(px(6.))
		.rounded(theme::RADIUS_PILL)
		.bg(theme::color(color))
}

/// A quiet bordered button; `active` tints it with the accent.
pub fn button(
	id: impl Into<SharedString>,
	label: impl Into<SharedString>,
	active: bool,
) -> Stateful<Div> {
	let id: SharedString = id.into();
	div()
		.id(id)
		.flex_none()
		.flex()
		.items_center()
		.h(px(24.))
		.px(px(8.))
		.rounded(theme::RADIUS_CONTROL)
		.border_1()
		.text_size(theme::TEXT_SMALL)
		.cursor_pointer()
		.map(|button| {
			if active {
				button
					.border_color(theme::alpha(theme::ACCENT, 0.4))
					.bg(theme::accent_soft())
					.text_color(theme::color(theme::ACCENT_HOVER))
			} else {
				button
					.border_color(theme::color(theme::BORDER_STRONG))
					.text_color(theme::color(theme::TEXT_SECONDARY))
					.hover(|button| {
						button
							.bg(theme::color(theme::HOVER))
							.text_color(theme::color(theme::TEXT))
					})
			}
		})
		.child(label.into())
}

/// The accent-filled primary action.
pub fn primary_button(
	id: impl Into<SharedString>,
	label: impl Into<SharedString>,
	busy: bool,
) -> Stateful<Div> {
	let id: SharedString = id.into();
	div()
		.id(id)
		.flex_none()
		.flex()
		.items_center()
		.h(px(28.))
		.px(px(12.))
		.rounded(theme::RADIUS_CONTROL)
		.text_size(theme::TEXT_SMALL)
		.font_weight(FontWeight::MEDIUM)
		.text_color(theme::color(0xFFFFFF))
		.map(|button| {
			if busy {
				button.bg(theme::alpha(theme::ACCENT, 0.55))
			} else {
				button
					.bg(theme::color(theme::ACCENT))
					.cursor_pointer()
					.hover(|button| button.bg(theme::color(theme::ACCENT_HOVER)))
			}
		})
		.child(label.into())
}

/// The 10.5 px uppercase section label.
pub fn eyebrow(text: &str) -> Div {
	div()
		.text_size(theme::TEXT_EYEBROW)
		.font_weight(FontWeight::SEMIBOLD)
		.text_color(theme::color(theme::TEXT_MUTED))
		.child(text.to_uppercase())
}
