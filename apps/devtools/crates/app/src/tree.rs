use std::ops::Range;

use gpui::{
	AnyElement, ClickEvent, Context, MouseButton, SharedString, Stateful, Window, div, prelude::*,
	px, uniform_list,
};
use unbound_devtools_core::{Element, ElementKind, Row};

use crate::app::Workspace;
use crate::indent_follow::guide_left;
use crate::smooth_scroll::SmoothScroll;
use crate::widgets::{badge, icon, icon_button, panel_header, tooltip, turning_chevron};
use crate::{assets, theme};

/// The list's padding above its first row.
const LIST_TOP: f32 = 4.;
const CRUMB_PADDING: f32 = 4.;
const CRUMB_GAP: f32 = 2.;
/// Breadcrumbs: their bar's sideways scroll.
const CRUMB_BAR: &str = "crumbs";

fn name_spans(element: &Element, matched: bool) -> gpui::Div {
	let name_color = if element.kind == ElementKind::Host {
		theme::SYN_HOST
	} else {
		theme::SYN_COMPONENT
	};
	div()
		.flex()
		.flex_none()
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_MONO)
		.child(div().text_color(theme::color(theme::TEXT_FAINT)).child("<"))
		.child(
			div()
				.text_color(theme::color(name_color))
				.when(matched, |name| {
					name.text_decoration_1()
						.text_decoration_color(theme::color(theme::ACCENT))
				})
				.child(SharedString::from(element.name.to_string())),
		)
		.when_some(element.key.as_ref(), |spans, key| {
			spans
				.child(
					div()
						.text_color(theme::color(theme::SYN_KEY_ATTR))
						.child(" key="),
				)
				.child(
					div()
						.text_color(theme::color(theme::SYN_KEY_VALUE))
						.child(format!("\"{key}\"")),
				)
		})
		.child(div().text_color(theme::color(theme::TEXT_FAINT)).child(">"))
}

impl Workspace {
	fn render_rows(
		&self,
		range: Range<usize>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> Vec<AnyElement> {
		let focused = self.tree_focus.contains_focused(window, cx);
		let store = self.devtools.store();
		let shift = self.indent.shift();
		range
			.filter_map(|ix| {
				let (ix, place) = self.fold.place(ix);
				let row = *self.rows.get(ix)?;
				let element = store.get(row.id)?;
				let drawn = self.render_row(ix, row, element, shift, focused, cx);
				Some(place.fit(drawn, theme::ROW_HEIGHT).into_any_element())
			})
			.collect()
	}

	fn render_row(
		&self,
		ix: usize,
		row: Row,
		element: &Element,
		shift: f32,
		focused: bool,
		cx: &mut Context<Self>,
	) -> Stateful<gpui::Div> {
		let id = row.id;
		let turn = self.fold.turn(&id, !self.collapsed.contains(&id));
		let selected = self.synced_selection == Some(id);
		let matched = self.search.set.contains(&id);
		let indent = (row.depth as f32 - shift) * theme::INDENT;
		// Levels shifted out past the left edge draw no guide.
		let guides = (shift.floor() as u32..row.depth).map(|level| {
			div()
				.absolute()
				.top_0()
				.bottom_0()
				.left(px(guide_left(level, shift)))
				.w(px(1.))
				.bg(theme::color(theme::BORDER))
		});
		div()
			.id(("row", ix))
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
			.map(|row| match (selected, focused) {
				(true, true) => row
					.bg(theme::accent_soft())
					.border_color(theme::alpha(theme::ACCENT, 0.35)),
				(true, false) => row
					.bg(theme::color(theme::SYN_HOC_BG))
					.border_color(gpui::transparent_black()),
				(false, _) => row
					.border_color(gpui::transparent_black())
					.hover(|row| row.bg(theme::color(theme::HOVER))),
			})
			.children(guides)
			.child(
				div()
					.id(("chevron", ix))
					.flex_none()
					.ml(px(indent.min(0.)))
					.w(px(theme::CHEVRON_SLOT))
					.h_full()
					.flex()
					.items_center()
					.justify_center()
					.when(row.has_children, |slot| {
						slot.child(turning_chevron(turn)).on_mouse_down(
							MouseButton::Left,
							cx.listener(move |this, _, _, cx| {
								cx.stop_propagation();
								this.toggle(id, cx);
							}),
						)
					}),
			)
			.child(name_spans(element, matched))
			.children(
				element
					.hocs
					.iter()
					.map(|hoc| badge(hoc.to_string(), theme::SYN_HOC_TEXT)),
			)
			.child(div().flex_1())
			.when(element.errors > 0, |row| {
				row.child(badge(element.errors.to_string(), theme::ERROR))
			})
			.when(element.warnings > 0, |row| {
				row.child(badge(element.warnings.to_string(), theme::WARNING))
			})
			.on_click(cx.listener(move |this, event: &ClickEvent, _, cx| {
				if event.click_count() == 2 && row.has_children {
					this.toggle(id, cx);
				}
				this.select(Some(id), cx);
			}))
	}

	/// The selection's ancestry, root first, in a bar that scrolls sideways (trackpad, or Shift and
	/// the wheel) and lands on the selection whenever it changes.
	fn render_breadcrumbs(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
		let store = self.devtools.store();
		let mut chain: Vec<&Element> = Vec::new();
		if let Some(selected) = self.synced_selection.and_then(|id| store.get(id)) {
			chain.push(selected);
			chain.extend(
				store
					.ancestors(selected.id)
					.filter(|element| element.kind != ElementKind::Root),
			);
		}
		chain.reverse();
		let last = chain.len().saturating_sub(1);
		if self.crumbs_for != self.synced_selection {
			self.crumbs_for = self.synced_selection;
			// Crumbs alternate with separators, so the selection is the last child.
			self.crumb_scroll.scroll_to_item(2 * last);
		}
		let empty = chain.is_empty();
		let crumbs = chain.into_iter().enumerate().flat_map(|(ix, element)| {
			let id = element.id;
			let current = ix == last;
			let crumb = div()
				.id(("crumb", ix))
				.flex_none()
				.px(px(CRUMB_PADDING))
				.rounded(theme::RADIUS_CONTROL)
				.cursor_pointer()
				.text_color(theme::color(if current {
					theme::TEXT
				} else {
					theme::TEXT_SECONDARY
				}))
				.hover(|crumb| {
					crumb
						.bg(theme::color(theme::HOVER))
						.text_color(theme::color(theme::TEXT))
				})
				.child(element.name.to_string())
				.on_click(cx.listener(move |this, _, _, cx| this.select(Some(id), cx)))
				.into_any_element();
			let separator = (ix > 0).then(|| {
				icon(assets::CHEVRON_RIGHT, theme::CHEVRON, theme::TEXT_FAINT).into_any_element()
			});
			separator.into_iter().chain(Some(crumb))
		});
		let crumbs: Vec<AnyElement> = crumbs.collect();
		drop(store);
		div()
			.flex_none()
			.h(theme::BREADCRUMB_HEIGHT)
			.flex()
			.border_t_1()
			.border_color(theme::color(theme::BORDER))
			.bg(theme::color(theme::PANEL))
			.child(
				div()
					.id(CRUMB_BAR)
					.flex_1()
					.min_w_0()
					.h_full()
					.flex()
					.items_center()
					.gap(px(CRUMB_GAP))
					.px(px(theme::INSET))
					.overflow_x_scroll()
					.track_scroll(&self.crumb_scroll)
					.whitespace_nowrap()
					.text_size(theme::TEXT_SMALL)
					.when(empty, |bar| {
						bar.child(
							div()
								.px(px(CRUMB_PADDING))
								.text_color(theme::color(theme::TEXT_FAINT))
								.child("No Selection"),
						)
					})
					.children(crumbs),
			)
	}

	fn render_tree_header(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let show_host = self.status.show_host_components;
		panel_header()
			.child(
				div()
					.flex_1()
					.text_color(theme::color(theme::TEXT_SECONDARY))
					.child("Components"),
			)
			.child(
				icon_button("host", assets::LAYERS, show_host)
					.tooltip(tooltip(if show_host {
						"Hide Host Components"
					} else {
						"Show Host Components"
					}))
					.on_click(
						cx.listener(move |this, _, _, _| this.set_show_host_components(!show_host)),
					),
			)
	}

	pub fn render_tree_panel(
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
			|ix| rows[ix].depth,
			window,
			cx,
		);
		let list = uniform_list(
			"tree",
			self.fold.count(self.rows.len()),
			cx.processor(|this, range: Range<usize>, window, cx| {
				this.render_rows(range, window, cx)
			}),
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
			.key_context("Tree")
			.track_focus(&self.tree_focus)
			.on_mouse_down(
				MouseButton::Left,
				cx.listener(|this, _, window, cx| window.focus(&this.tree_focus, cx)),
			)
			.child(self.render_tree_header(cx))
			.child(
				div()
					.flex_1()
					.min_h_0()
					.flex()
					.flex_col()
					.child(SmoothScroll::new("tree-glide", &self.scroll, list)),
			)
			.child(self.render_breadcrumbs(cx))
	}
}
