//! The component tree: a virtualized list of rows plus the selection's breadcrumb bar.

use std::ops::Range;

use gpui::{
	AnyElement, ClickEvent, Context, MouseButton, SharedString, div, prelude::*, px, uniform_list,
};
use unbound_devtools_core::{Element, ElementKind, Row, Store};

use crate::app::Workspace;
use crate::theme;
use crate::widgets::pill;

/// Rows deeper than this many levels past the selection's are shifted left, so Discord's deep
/// trees stay readable without horizontal scrolling.
const VISIBLE_LEVELS: u32 = 16;
const BREADCRUMB_LIMIT: usize = 24;

fn name_spans(element: &Element, matched: bool) -> gpui::Div {
	let name_color = if element.kind == ElementKind::Host {
		theme::SYN_HOST
	} else {
		theme::SYN_COMPONENT
	};
	div()
		.flex()
		.flex_none()
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
	fn indent_shift(&self, store: &Store) -> u32 {
		self.selected
			.and_then(|id| store.get(id))
			.map_or(0, |element| element.depth.saturating_sub(VISIBLE_LEVELS))
	}

	fn render_rows(&self, range: Range<usize>, cx: &mut Context<Self>) -> Vec<AnyElement> {
		let store = self.devtools.store();
		let shift = self.indent_shift(&store);
		range
			.filter_map(|ix| {
				let row = *self.rows.get(ix)?;
				let element = store.get(row.id)?;
				Some(self.render_row(ix, row, element, shift, cx))
			})
			.collect()
	}

	fn render_row(
		&self,
		ix: usize,
		row: Row,
		element: &Element,
		shift: u32,
		cx: &mut Context<Self>,
	) -> AnyElement {
		let id = row.id;
		let selected = self.selected == Some(id);
		let matched = self.search.set.contains(&id);
		let depth = row.depth.saturating_sub(shift);
		let guides = (0..depth).map(|level| {
			div()
				.absolute()
				.top_0()
				.bottom_0()
				.left(px(8. + level as f32 * theme::INDENT + 5.))
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
			.pl(px(8. + depth as f32 * theme::INDENT))
			.pr(px(8.))
			.whitespace_nowrap()
			.overflow_hidden()
			.map(|row| {
				if selected {
					row.bg(theme::accent_soft())
				} else {
					row.hover(|row| row.bg(theme::color(theme::HOVER)))
				}
			})
			.children(guides)
			.when(selected, |row| {
				row.child(
					div()
						.absolute()
						.left_0()
						.top_0()
						.bottom_0()
						.w(px(2.))
						.bg(theme::color(theme::ACCENT)),
				)
			})
			.child(
				div()
					.id(("chevron", ix))
					.w(px(12.))
					.ml(px(-4.))
					.flex_none()
					.flex()
					.justify_center()
					.text_size(px(10.))
					.text_color(theme::color(theme::TEXT_MUTED))
					.when(row.has_children, |chevron| {
						chevron
							.child(if row.expanded { "▾" } else { "▸" })
							.on_mouse_down(
								MouseButton::Left,
								cx.listener(move |this, _, _, cx| {
									cx.stop_propagation();
									this.toggle(id, cx);
								}),
							)
					}),
			)
			.child(name_spans(element, matched))
			.children(element.hocs.iter().map(|hoc| {
				pill(
					hoc.to_string(),
					theme::SYN_HOC_TEXT,
					theme::color(theme::SYN_HOC_BG),
				)
			}))
			.child(div().flex_1())
			.when(element.errors > 0, |row| {
				row.child(pill(
					element.errors.to_string(),
					theme::ERROR,
					theme::alpha(theme::ERROR, 0.16),
				))
			})
			.when(element.warnings > 0, |row| {
				row.child(pill(
					element.warnings.to_string(),
					theme::WARNING,
					theme::alpha(theme::WARNING, 0.16),
				))
			})
			.on_click(cx.listener(move |this, event: &ClickEvent, _, cx| {
				if event.click_count() == 2 && row.has_children {
					this.toggle(id, cx);
				}
				this.select(Some(id), cx);
			}))
			.into_any_element()
	}

	fn render_breadcrumbs(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let store = self.devtools.store();
		let mut chain: Vec<&Element> = Vec::new();
		if let Some(selected) = self.selected.and_then(|id| store.get(id)) {
			chain.push(selected);
			let ancestors = store
				.ancestors(selected.id)
				.filter(|element| element.kind != ElementKind::Root);
			chain.extend(ancestors.take(BREADCRUMB_LIMIT - 1));
			chain.reverse();
		}
		let last = chain.len().saturating_sub(1);
		let crumbs = chain.into_iter().enumerate().flat_map(|(ix, element)| {
			let id = element.id;
			let color = if ix == last {
				theme::TEXT
			} else {
				theme::TEXT_SECONDARY
			};
			let crumb = div()
				.id(("crumb", ix))
				.flex_none()
				.px(px(4.))
				.rounded(px(4.))
				.cursor_pointer()
				.text_color(theme::color(color))
				.hover(|crumb| {
					crumb
						.bg(theme::color(theme::HOVER))
						.text_color(theme::color(theme::TEXT))
				})
				.child(element.name.to_string())
				.on_click(cx.listener(move |this, _, _, cx| this.select(Some(id), cx)))
				.into_any_element();
			let separator = (ix > 0).then(|| {
				div()
					.flex_none()
					.text_color(theme::color(theme::TEXT_FAINT))
					.child("›")
					.into_any_element()
			});
			separator.into_iter().chain(Some(crumb))
		});
		div()
			.flex_none()
			.h(theme::BREADCRUMB_HEIGHT)
			.flex()
			.items_center()
			.justify_end()
			.gap(px(2.))
			.px(px(8.))
			.overflow_hidden()
			.whitespace_nowrap()
			.border_t_1()
			.border_color(theme::color(theme::BORDER))
			.bg(theme::color(theme::PANEL))
			.text_size(theme::TEXT_SMALL)
			.children(crumbs)
	}

	pub fn render_tree_panel(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
		let list = uniform_list(
			"tree",
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
			.key_context("Tree")
			.track_focus(&self.tree_focus)
			.on_mouse_down(
				MouseButton::Left,
				cx.listener(|this, _, window, cx| window.focus(&this.tree_focus, cx)),
			)
			.font_family(theme::mono_font())
			.text_size(theme::TEXT_MONO)
			.child(list)
			.child(self.render_breadcrumbs(cx).into_any_element())
	}
}
