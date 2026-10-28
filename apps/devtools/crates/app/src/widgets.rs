//! Small styled building blocks shared by the views.

use gpui::{
	AnyView, App, Context, Div, FontWeight, SharedString, Stateful, Svg, Window, div, prelude::*,
	px, svg,
};

use crate::theme;

pub fn icon(path: &'static str, size: gpui::Pixels, color: u32) -> Svg {
	svg()
		.path(path)
		.flex_none()
		.size(size)
		.text_color(theme::color(color))
}

/// A tree or value chevron, pointing right when collapsed and down when expanded.
pub fn chevron(expanded: bool) -> Svg {
	let path = if expanded {
		crate::assets::CHEVRON_DOWN
	} else {
		crate::assets::CHEVRON_RIGHT
	};
	icon(path, theme::CHEVRON, theme::TEXT_MUTED)
}

/// A small label for kinds, HOC names and counts.
pub fn badge(text: impl Into<SharedString>, fg: u32) -> Div {
	div()
		.flex_none()
		.flex()
		.items_center()
		.h(px(16.))
		.px(px(4.))
		.rounded(px(3.))
		.bg(theme::color(theme::SYN_HOC_BG))
		.text_color(theme::color(fg))
		.text_size(px(11.))
		.line_height(px(16.))
		.child(text.into())
}

struct Tooltip(SharedString);

impl Render for Tooltip {
	fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
		div()
			.font_family(theme::ui_font())
			.text_size(theme::TEXT_SMALL)
			.text_color(theme::color(theme::TEXT))
			.px(px(8.))
			.py(px(4.))
			.rounded(theme::RADIUS_CONTROL)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(theme::color(theme::BORDER_STRONG))
			.child(self.0.clone())
	}
}

pub fn tooltip(text: &'static str) -> impl Fn(&mut Window, &mut App) -> AnyView + 'static {
	move |_, cx| cx.new(|_| Tooltip(text.into())).into()
}

/// A square ghost button holding one icon; `active` tints the icon with the accent.
pub fn icon_button(id: &'static str, path: &'static str, active: bool) -> Stateful<Div> {
	div()
		.id(id)
		.flex_none()
		.size(theme::ICON_BUTTON)
		.flex()
		.items_center()
		.justify_center()
		.rounded(theme::RADIUS_CONTROL)
		.cursor_pointer()
		.when(active, |button| button.bg(theme::accent_soft()))
		.hover(|button| button.bg(theme::color(theme::HOVER)))
		.child(icon(
			path,
			theme::ICON,
			if active {
				theme::ACCENT_HOVER
			} else {
				theme::TEXT_SECONDARY
			},
		))
}

/// A ghost button with an icon and a label.
pub fn ghost_button(
	id: &'static str,
	path: &'static str,
	label: impl Into<SharedString>,
) -> Stateful<Div> {
	div()
		.id(id)
		.flex_none()
		.flex()
		.items_center()
		.gap(px(6.))
		.h(theme::ICON_BUTTON)
		.px(px(8.))
		.rounded(theme::RADIUS_CONTROL)
		.cursor_pointer()
		.text_size(theme::TEXT_SMALL)
		.text_color(theme::color(theme::TEXT_SECONDARY))
		.hover(|button| {
			button
				.bg(theme::color(theme::HOVER))
				.text_color(theme::color(theme::TEXT))
		})
		.child(icon(path, theme::ICON, theme::TEXT_SECONDARY))
		.child(label.into())
}

/// The accent-filled primary action.
pub fn primary_button(
	id: &'static str,
	label: impl Into<SharedString>,
	busy: bool,
) -> Stateful<Div> {
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

/// The uppercase section label.
pub fn eyebrow(text: &str) -> Div {
	div()
		.text_size(theme::TEXT_EYEBROW)
		.text_color(theme::color(theme::TEXT_MUTED))
		.child(text.to_uppercase())
}

/// A 32 px panel header: the bar above the tree and the inspector.
pub fn panel_header() -> Div {
	div()
		.flex_none()
		.h(theme::PANEL_HEADER_HEIGHT)
		.flex()
		.items_center()
		.gap(px(4.))
		.pl(px(theme::INSET + 4.))
		.pr(px(6.))
		.border_b_1()
		.border_color(theme::color(theme::BORDER))
		.bg(theme::color(theme::PANEL))
}
