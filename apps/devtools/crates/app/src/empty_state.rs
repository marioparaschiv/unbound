//! The app's empty state: a muted icon, a title and a line of guidance, centred in the space it
//! fills. Anything added as a child (an error chip, buttons, a footnote) goes below.

use gpui::{AnyElement, App, FontWeight, SharedString, Window, div, prelude::*, px};

use crate::theme::{self, Token};
use crate::widgets::icon;

/// Large enough to anchor the column, small enough that Lucide's stroke stays near the UI's weight.
const GLYPH: f32 = 28.;
const COLUMN_WIDTH: f32 = 400.;

#[derive(IntoElement)]
pub struct EmptyState {
	icon: &'static str,
	tone: Token,
	title: SharedString,
	body: Option<SharedString>,
	children: Vec<AnyElement>,
}

impl EmptyState {
	/// A neutral state; `icon` is an asset path such as `icons/unplug.svg`.
	pub fn new(icon: &'static str, title: impl Into<SharedString>) -> Self {
		Self {
			icon,
			tone: theme::TEXT_FAINT,
			title: title.into(),
			body: None,
			children: Vec::new(),
		}
	}

	/// Tints the icon, such as [`theme::ERROR`] for a failure.
	pub fn tone(mut self, tone: Token) -> Self {
		self.tone = tone;
		self
	}

	pub fn body(mut self, body: impl Into<SharedString>) -> Self {
		self.body = Some(body.into());
		self
	}
}

impl ParentElement for EmptyState {
	fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
		self.children.extend(elements);
	}
}

impl RenderOnce for EmptyState {
	fn render(self, _: &mut Window, _: &mut App) -> impl IntoElement {
		div()
			.flex_1()
			.min_h_0()
			.flex()
			.items_center()
			.justify_center()
			.px(px(24.))
			.child(
				div()
					.w(px(COLUMN_WIDTH))
					.max_w_full()
					.flex()
					.flex_col()
					.items_center()
					.gap(px(12.))
					.child(icon(self.icon, px(GLYPH), self.tone).mb(px(4.)))
					.child(
						div()
							.text_size(theme::TEXT_HERO)
							.font_weight(FontWeight::SEMIBOLD)
							.text_color(theme::color(theme::TEXT))
							.child(self.title),
					)
					.children(self.body.map(|body| {
						div()
							.text_center()
							.line_height(px(20.))
							.text_color(theme::color(theme::TEXT_SECONDARY))
							.child(body)
					}))
					.children(self.children),
			)
	}
}
