use std::ops::Range;

use gpui::{
	AnyElement, ClickEvent, Context, MouseButton, Pixels, SharedString, TextRun, Window, div, font,
	prelude::*, px, uniform_list,
};
use unbound_devtools_core::{Element, ElementKind, Row, Store};

use crate::app::Workspace;
use crate::widgets::{badge, chevron, icon, icon_button, panel_header, tooltip};
use crate::{assets, theme};

const VISIBLE_LEVELS: u32 = 16;
const CRUMB_PADDING: f32 = 4.;
const CRUMB_GAP: f32 = 2.;

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

fn ui_text_width(window: &Window, text: &str, size: Pixels) -> f32 {
	let run = TextRun {
		len: text.len(),
		font: font(theme::ui_font()),
		color: theme::hsla(theme::TEXT),
		background_color: None,
		underline: None,
		strikethrough: None,
	};
	f32::from(
		window
			.text_system()
			.shape_line(SharedString::from(text.to_owned()), size, &[run], None)
			.width(),
	)
}

impl Workspace {
	fn indent_shift(&self, store: &Store) -> u32 {
		self.selected
			.and_then(|id| store.get(id))
			.map_or(0, |element| element.depth.saturating_sub(VISIBLE_LEVELS))
	}

	fn render_rows(
		&self,
		range: Range<usize>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> Vec<AnyElement> {
		let focused = self.tree_focus.contains_focused(window, cx);
		let store = self.devtools.store();
		let shift = self.indent_shift(&store);
		range
			.filter_map(|ix| {
				let row = *self.rows.get(ix)?;
				let element = store.get(row.id)?;
				Some(self.render_row(ix, row, element, shift, focused, cx))
			})
			.collect()
	}

	fn render_row(
		&self,
		ix: usize,
		row: Row,
		element: &Element,
		shift: u32,
		focused: bool,
		cx: &mut Context<Self>,
	) -> AnyElement {
		let id = row.id;
		let selected = self.selected == Some(id);
		let matched = self.search.set.contains(&id);
		let indent = (row.depth as f32 - shift as f32) * theme::INDENT;
		let depth = row.depth.saturating_sub(shift);
		let guides = (0..depth).map(|level| {
			div()
				.absolute()
				.top_0()
				.bottom_0()
				.left(px(theme::INSET
					+ level as f32 * theme::INDENT
					+ theme::INDENT / 2.))
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
					.w(px(theme::INDENT))
					.h_full()
					.flex()
					.items_center()
					.justify_center()
					.when(row.has_children, |slot| {
						slot.child(chevron(row.expanded)).on_mouse_down(
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
			.into_any_element()
	}

	fn render_breadcrumbs(
		&self,
		width: f32,
		window: &Window,
		cx: &mut Context<Self>,
	) -> impl IntoElement {
		let store = self.devtools.store();
		let mut chain: Vec<&Element> = Vec::new();
		if let Some(selected) = self.selected.and_then(|id| store.get(id)) {
			chain.push(selected);
			chain.extend(
				store
					.ancestors(selected.id)
					.filter(|element| element.kind != ElementKind::Root),
			);
		}
		let separator = f32::from(theme::CHEVRON) + 2. * CRUMB_GAP;
		let mut budget = width - 2. * theme::INSET;
		let mut shown = 0;
		for (ix, element) in chain.iter().enumerate() {
			let cost = ui_text_width(window, &element.name, theme::TEXT_SMALL)
				+ 2. * CRUMB_PADDING
				+ if ix > 0 { separator } else { 0. };
			let reserve = if ix + 1 < chain.len() { separator } else { 0. };
			if cost + reserve > budget && shown > 0 {
				break;
			}
			budget -= cost;
			shown += 1;
		}
		let truncated = shown < chain.len();
		chain.truncate(shown);
		chain.reverse();
		let last = chain.len().saturating_sub(1);
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
			let separator = (ix > 0 || truncated).then(|| {
				icon(assets::CHEVRON_RIGHT, theme::CHEVRON, theme::TEXT_FAINT).into_any_element()
			});
			separator.into_iter().chain(Some(crumb))
		});
		div()
			.flex_none()
			.h(theme::BREADCRUMB_HEIGHT)
			.flex()
			.items_center()
			.gap(px(CRUMB_GAP))
			.px(px(theme::INSET))
			.overflow_hidden()
			.whitespace_nowrap()
			.border_t_1()
			.border_color(theme::color(theme::BORDER))
			.bg(theme::color(theme::PANEL))
			.text_size(theme::TEXT_SMALL)
			.when(last == 0 && shown == 0, |bar| {
				bar.child(
					div()
						.px(px(CRUMB_PADDING))
						.text_color(theme::color(theme::TEXT_FAINT))
						.child("No selection"),
				)
			})
			.children(crumbs)
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
						"Hide host components"
					} else {
						"Show host components"
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
		let width = f32::from(window.viewport_size().width) - self.inspector_width(window) - 1.;
		let list = uniform_list(
			"tree",
			self.rows.len(),
			cx.processor(|this, range: Range<usize>, window, cx| {
				this.render_rows(range, window, cx)
			}),
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
			.child(self.render_tree_header(cx))
			.child(div().flex_1().min_h_0().flex().flex_col().child(list))
			.child(self.render_breadcrumbs(width, window, cx))
	}
}
