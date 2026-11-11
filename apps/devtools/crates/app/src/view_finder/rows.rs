//! The View Tree's rows, drawn like the Components tree: guides, a chevron, `<ClassName id="…">`.

use std::ops::Range;

use gpui::{AnyElement, ClickEvent, Context, MouseButton, div, prelude::*, px, uniform_list};
use unbound_devtools_core::{ViewNode, Visibility};

use super::{Row, ViewFinder};
use crate::smooth_scroll::SmoothScroll;
use crate::theme;
use crate::widgets::{badge, chevron, panel_header};

/// Rows deeper than this below the selection's level shift left, so deep trees stay readable.
const VISIBLE_LEVELS: u32 = 16;

pub(super) fn visibility_label(visibility: Visibility) -> &'static str {
	match visibility {
		Visibility::Visible => "visible",
		Visibility::Invisible => "invisible",
		Visibility::Gone => "gone",
	}
}

fn name_spans(node: &ViewNode) -> gpui::Div {
	let name = if node.visibility == Visibility::Visible {
		theme::SYN_COMPONENT
	} else {
		theme::TEXT_MUTED
	};
	div()
		.flex()
		.flex_none()
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_MONO)
		.child(div().text_color(theme::color(theme::TEXT_FAINT)).child("<"))
		.child(
			div()
				.text_color(theme::color(name))
				.child(node.short_name().to_owned()),
		)
		.when_some(node.resource_name.as_ref(), |spans, resource| {
			spans
				.child(
					div()
						.text_color(theme::color(theme::SYN_KEY_ATTR))
						.child(" id="),
				)
				.child(
					div()
						.text_color(theme::color(theme::SYN_KEY_VALUE))
						.child(format!("\"{resource}\"")),
				)
		})
		.child(div().text_color(theme::color(theme::TEXT_FAINT)).child(">"))
}

/// The vertical lines that join a row to its ancestors, one per visible level.
fn guides(depth: u32) -> impl Iterator<Item = gpui::Div> {
	(0..depth).map(|level| {
		div()
			.absolute()
			.top_0()
			.bottom_0()
			.left(px(theme::INSET
				+ level as f32 * theme::INDENT
				+ theme::INDENT / 2.))
			.w(px(1.))
			.bg(theme::color(theme::BORDER))
	})
}

fn row_shell(ix: usize, depth: u32) -> gpui::Stateful<gpui::Div> {
	div()
		.id(("view-row", ix))
		.relative()
		.w_full()
		.h(theme::ROW_HEIGHT)
		.flex()
		.items_center()
		.gap(px(4.))
		.pl(px(theme::INSET + depth as f32 * theme::INDENT))
		.pr(px(theme::INSET))
		.whitespace_nowrap()
		.overflow_hidden()
		.mx(px(4.))
		.rounded(theme::RADIUS_ITEM)
		.border_1()
		.children(guides(depth))
}

impl ViewFinder {
	fn indent_shift(&self) -> u32 {
		let selected = self.selected.as_deref();
		self.rows
			.iter()
			.find_map(|row| match row {
				Row::View { id, depth, .. } if Some(id.as_str()) == selected => Some(*depth),
				_ => None,
			})
			.map_or(0, |depth| depth.saturating_sub(VISIBLE_LEVELS))
	}

	fn render_rows(&self, range: Range<usize>, cx: &mut Context<Self>) -> Vec<AnyElement> {
		let shift = self.indent_shift();
		range
			.filter_map(|ix| {
				let row = self.rows.get(ix)?;
				let depth = row.depth().saturating_sub(shift);
				match row {
					Row::View { id, expanded, .. } => {
						let node = self.nodes.get(id)?;
						Some(self.render_view(ix, node, depth, *expanded, cx))
					}
					Row::Note { text, error, .. } => Some(
						row_shell(ix, depth)
							.border_color(gpui::transparent_black())
							.child(div().flex_none().w(px(theme::CHEVRON_SLOT)))
							.child(
								div()
									.min_w_0()
									.truncate()
									.text_size(theme::TEXT_SMALL)
									.text_color(theme::color(if *error {
										theme::ERROR
									} else {
										theme::TEXT_FAINT
									}))
									.child(text.clone()),
							)
							.into_any_element(),
					),
				}
			})
			.collect()
	}

	fn render_view(
		&self,
		ix: usize,
		node: &ViewNode,
		depth: u32,
		expanded: bool,
		cx: &mut Context<Self>,
	) -> AnyElement {
		let id = node.id.clone();
		let selected = self.selected.as_deref() == Some(id.as_str());
		let has_children = node.child_count > 0;
		row_shell(ix, depth)
			.map(|row| {
				if selected {
					row.bg(theme::accent_soft())
						.border_color(theme::alpha(theme::ACCENT, 0.35))
				} else {
					row.border_color(gpui::transparent_black())
						.hover(|row| row.bg(theme::color(theme::HOVER)))
				}
			})
			.child(
				div()
					.id(("view-chevron", ix))
					.flex_none()
					.w(px(theme::CHEVRON_SLOT))
					.h_full()
					.flex()
					.items_center()
					.justify_center()
					.when(has_children, |slot| {
						let id = id.clone();
						slot.child(chevron(expanded)).on_mouse_down(
							MouseButton::Left,
							cx.listener(move |this, _, _, cx| {
								cx.stop_propagation();
								this.toggle(&id, cx);
							}),
						)
					}),
			)
			.child(name_spans(node))
			.when_some(node.text.as_ref(), |row, text| {
				row.child(
					div()
						.min_w_0()
						.truncate()
						.font_family(theme::mono_font())
						.text_size(theme::TEXT_SMALL)
						.text_color(theme::color(theme::SYN_STRING))
						.child(format!("\"{text}\"")),
				)
			})
			.child(div().flex_1())
			.when(node.visibility != Visibility::Visible, |row| {
				row.child(badge(visibility_label(node.visibility), theme::TEXT_MUTED))
			})
			.when(has_children, |row| {
				row.child(
					div()
						.flex_none()
						.text_size(theme::TEXT_EYEBROW)
						.text_color(theme::color(theme::TEXT_FAINT))
						.child(node.child_count.to_string()),
				)
			})
			.on_hover({
				let id = id.clone();
				cx.listener(move |this, hovered: &bool, _, cx| this.hover(&id, *hovered, cx))
			})
			.on_click(cx.listener(move |this, event: &ClickEvent, _, cx| {
				if event.click_count() == 2 && has_children {
					this.toggle(&id, cx);
				}
				this.select(&id, cx);
			}))
			.into_any_element()
	}

	pub(super) fn render_tree_panel(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let list = uniform_list(
			"views",
			self.rows.len(),
			cx.processor(|this, range: Range<usize>, _, cx| this.render_rows(range, cx)),
		)
		.track_scroll(&self.scroll)
		.flex_1()
		.py(px(4.));
		div()
			.flex_1()
			.min_w_0()
			.h_full()
			.flex()
			.flex_col()
			.child(
				panel_header().child(
					div()
						.flex_1()
						.text_color(theme::color(theme::TEXT_SECONDARY))
						.child("Native Views"),
				),
			)
			.child(
				div()
					.flex_1()
					.min_h_0()
					.flex()
					.flex_col()
					.child(SmoothScroll::new("views-glide", &self.scroll, list)),
			)
	}
}
