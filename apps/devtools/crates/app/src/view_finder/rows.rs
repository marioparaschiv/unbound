//! The View Tree's rows, drawn like the Components tree: guides, a chevron, `<ClassName id="…">`.

use std::ops::Range;

use gpui::{
	AnyElement, ClickEvent, Context, MouseButton, Window, div, prelude::*, px, uniform_list,
};
use unbound_devtools_core::{ViewNode, Visibility};

use super::{Row, ViewFinder};
use crate::indent_follow::guide_left;
use crate::smooth_scroll::SmoothScroll;
use crate::theme;
use crate::widgets::{badge, panel_header, turning_chevron};

/// The list's padding above its first row.
const LIST_TOP: f32 = 4.;

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

/// The vertical lines that join a row to its ancestors, one per level not shifted out of view.
fn guides(depth: u32, shift: f32) -> impl Iterator<Item = gpui::Div> {
	(shift.floor() as u32..depth).map(move |level| {
		div()
			.absolute()
			.top_0()
			.bottom_0()
			.left(px(guide_left(level, shift)))
			.w(px(1.))
			.bg(theme::color(theme::BORDER))
	})
}

/// How far a row `depth` levels deep is indented once rows shift left by `shift` levels; negative
/// once it has shifted past the left edge.
fn indent(depth: u32, shift: f32) -> f32 {
	(depth as f32 - shift) * theme::INDENT
}

/// A row `depth` levels deep, its indent less `shift` levels. A row shifted past the left edge
/// pulls its first child left by [`indent`]'s overhang, as the Components tree does.
fn row_shell(ix: usize, depth: u32, shift: f32) -> gpui::Stateful<gpui::Div> {
	let indent = indent(depth, shift);
	div()
		.id(("view-row", ix))
		.relative()
		.w_full()
		.h(theme::ROW_HEIGHT)
		.flex()
		.items_center()
		.gap(px(4.))
		.pl(px(theme::INSET + indent.max(0.)))
		.pr(px(theme::INSET))
		.whitespace_nowrap()
		.overflow_hidden()
		.mx(px(4.))
		.rounded(theme::RADIUS_ITEM)
		.border_1()
		.children(guides(depth, shift))
}

/// A row of text in place of views: a level loading or failing, or the rest of a long level.
fn note_row(
	ix: usize,
	depth: u32,
	shift: f32,
	text: gpui::SharedString,
	tone: theme::Token,
) -> gpui::Stateful<gpui::Div> {
	row_shell(ix, depth, shift)
		.border_color(gpui::transparent_black())
		.child(
			div()
				.flex_none()
				.ml(px(indent(depth, shift).min(0.)))
				.w(px(theme::CHEVRON_SLOT)),
		)
		.child(
			div()
				.min_w_0()
				.truncate()
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(tone))
				.child(text),
		)
}

impl ViewFinder {
	fn render_rows(&self, range: Range<usize>, cx: &mut Context<Self>) -> Vec<AnyElement> {
		let shift = self.indent.shift();
		range
			.filter_map(|ix| {
				let (ix, place) = self.fold.place(ix);
				let row = self.render_row(ix, shift, cx)?;
				Some(
					place
						.fit(div().w_full().child(row), theme::ROW_HEIGHT)
						.into_any_element(),
				)
			})
			.collect()
	}

	fn render_row(&self, ix: usize, shift: f32, cx: &mut Context<Self>) -> Option<AnyElement> {
		let row = self.rows.get(ix)?;
		let depth = row.depth();
		match row {
			Row::View { id, .. } => {
				let node = self.nodes.get(id)?;
				Some(self.render_view(ix, node, depth, shift, cx))
			}
			Row::Note { text, error, .. } => Some(
				note_row(
					ix,
					depth,
					shift,
					text.clone(),
					if *error {
						theme::ERROR
					} else {
						theme::TEXT_FAINT
					},
				)
				.into_any_element(),
			),
			Row::More {
				parent,
				text,
				loading,
				..
			} => {
				let row = note_row(
					ix,
					depth,
					shift,
					text.clone(),
					if *loading {
						theme::TEXT_FAINT
					} else {
						theme::ACCENT
					},
				);
				let parent = parent.clone();
				Some(
					row.when(!*loading, |row| {
						row.cursor_pointer()
							.hover(|row| row.bg(theme::color(theme::HOVER)))
							.on_click(cx.listener(move |this, _, _, cx| {
								this.show_more(parent.clone(), cx);
							}))
					})
					.into_any_element(),
				)
			}
		}
	}

	fn render_view(
		&self,
		ix: usize,
		node: &ViewNode,
		depth: u32,
		shift: f32,
		cx: &mut Context<Self>,
	) -> AnyElement {
		let id = node.id.clone();
		let turn = self.fold.turn(&id, self.expanded.contains(&id));
		let selected = self.selected.as_deref() == Some(id.as_str());
		let has_children = node.child_count > 0;
		row_shell(ix, depth, shift)
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
					.ml(px(indent(depth, shift).min(0.)))
					.w(px(theme::CHEVRON_SLOT))
					.h_full()
					.flex()
					.items_center()
					.justify_center()
					.when(has_children, |slot| {
						let id = id.clone();
						slot.child(turning_chevron(turn)).on_mouse_down(
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

	pub(super) fn render_tree_panel(
		&mut self,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> impl IntoElement {
		if self.fold.tick() {
			self.rebuild_rows();
		}
		if self.fold.moving() {
			window.request_animation_frame();
		}
		let rows = self.rows.clone();
		self.indent.follow(
			&self.scroll,
			rows.len(),
			LIST_TOP,
			|ix| rows[ix].depth(),
			window,
			cx,
		);
		let list = uniform_list(
			"views",
			self.fold.count(self.rows.len()),
			cx.processor(|this, range: Range<usize>, _, cx| this.render_rows(range, cx)),
		)
		.track_scroll(&self.scroll)
		.flex_1()
		.py(px(LIST_TOP));
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
