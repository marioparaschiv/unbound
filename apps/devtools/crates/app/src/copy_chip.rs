//! An inline code chip: a value in the mono font on a raised key, with a copy glyph. Clicking
//! anywhere on it copies the value; the chip presses like a flat control while its glyph swaps.

use gpui::{App, SharedString, TextRun, Window, div, font, prelude::*, px};

use crate::copy_glyph::{copied_state, copy_glyphs, copy_on_click, element_id};
use crate::press::Pressable;
use crate::theme;
use crate::widgets::{hairline, key_shadow};

const HEIGHT: f32 = 34.;
const PAD_X: f32 = 12.;
const GAP: f32 = 10.;
const GLYPH: f32 = 14.;
/// The chip's hover reaches its plate, which a press shrinks inside the chip's box.
const GROUP: &str = "copy-chip";

#[derive(IntoElement)]
pub struct CopyChip {
	id: SharedString,
	text: SharedString,
	min_width: f32,
	scale: f32,
}

impl CopyChip {
	/// Widens the chip to at least `width`, so chips stacked in a column share an edge; the glyph
	/// stays at the right.
	pub fn min_width(mut self, width: f32) -> Self {
		self.min_width = width;
		self
	}

	/// Draws every length at `scale`, for a chip inside a popout that grows open.
	pub fn scale(mut self, scale: f32) -> Self {
		self.scale = scale;
		self
	}
}

/// A chip showing `text` that copies it on click. `id` must be unique on screen.
pub fn copy_chip(id: impl Into<SharedString>, text: impl Into<SharedString>) -> CopyChip {
	CopyChip {
		id: id.into(),
		text: text.into(),
		min_width: 0.,
		scale: 1.,
	}
}

/// The width a chip showing `text` takes before [`CopyChip::min_width`] widens it.
pub fn natural_width(window: &Window, text: &SharedString) -> f32 {
	2. * PAD_X + text_width(window, text) + GAP + GLYPH + 2.
}

fn text_width(window: &Window, text: &SharedString) -> f32 {
	let run = TextRun {
		len: text.len(),
		font: font(theme::mono_font()),
		color: theme::hsla(theme::TEXT),
		background_color: None,
		underline: None,
		strikethrough: None,
	};
	f32::from(
		window
			.text_system()
			.shape_line(text.clone(), theme::TEXT_SMALL, &[run], None)
			.width(),
	)
}

impl RenderOnce for CopyChip {
	fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
		let id = self.id;
		let state = copied_state(&id, window, cx);
		let showing = state.read(cx).showing;
		// `scale` is the popout's growth; a press shrinks only the plate, under still text.
		let s = self.scale;
		let width = natural_width(window, &self.text).max(self.min_width) * s;
		let body = div()
			.flex_none()
			.w(px(width))
			.h(px(HEIGHT * s))
			.group(GROUP)
			.cursor_pointer();
		let plate = move |plate: gpui::Div, press: f32| {
			plate
				.rounded(theme::RADIUS_CONTROL * (press * s))
				.bg(theme::color(theme::ELEVATED))
				.border_1()
				.border_color(hairline())
				.shadow(key_shadow())
				.group_hover(GROUP, |plate| plate.bg(theme::color(theme::SECONDARY)))
		};
		let content = div()
			.relative()
			.size_full()
			.flex()
			.items_center()
			.gap(px(GAP * s))
			.px(px(PAD_X * s))
			.font_family(theme::mono_font())
			.text_size(theme::TEXT_SMALL * s)
			.text_color(theme::color(theme::TEXT))
			.child(div().flex_1().whitespace_nowrap().child(self.text.clone()))
			.child(copy_glyphs(&id, GLYPH * s, theme::TEXT_MUTED, showing));
		let view = window.current_view();
		Pressable::flat(element_id(&id, "press"), body, plate)
			.child(content)
			.on_click(copy_on_click(state, view, self.text))
	}
}
