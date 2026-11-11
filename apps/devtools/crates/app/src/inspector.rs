use gpui::{AnyElement, Context, FontWeight, SharedString, Window, div, prelude::*, px};
use unbound_devtools_core::{ElementKind, InspectedElement, Path, Value};

use crate::app::Workspace;
use crate::inspection::{Inspection, key};
use crate::smooth_scroll::SmoothScroll;
use crate::values::Rows;
use crate::widgets::{badge, chevron, hairline, icon, icon_button, panel_header, tooltip};
use crate::{assets, theme};

/// The gap around and between the section cards.
const CARD_GAP: f32 = 10.;
const CARD_HEADER_HEIGHT: f32 = 34.;

/// How many rows a section's root value lists at its top level.
fn entry_count(value: Option<&Value>) -> usize {
	match value {
		None => 0,
		Some(Value::Array(items)) => items.len(),
		Some(Value::Object(entries)) => entries.len(),
		Some(_) => 1,
	}
}

fn centered(text: impl Into<SharedString>, color: theme::Token) -> gpui::Div {
	div()
		.flex_1()
		.flex()
		.items_center()
		.justify_center()
		.px(px(24.))
		.text_color(theme::color(color))
		.child(text.into())
}

/// A row inside a card, on the value rows' inset so its text starts on their line.
fn card_row() -> gpui::Div {
	div()
		.flex()
		.items_center()
		.gap(px(6.))
		.min_h(theme::VALUE_ROW_HEIGHT)
		.mx(px(4.))
		.px(px(8.))
		.rounded(theme::RADIUS_ITEM - px(2.))
		.whitespace_nowrap()
		.overflow_hidden()
}

/// A component as a chip: `<Name>` on a raised pill, as the tree draws it. Clicking selects it.
fn component_chip(name: SharedString, kind: ElementKind) -> gpui::Div {
	let color = if kind == ElementKind::Host {
		theme::SYN_HOST
	} else {
		theme::SYN_COMPONENT
	};
	div()
		.flex()
		.items_center()
		.h(px(26.))
		.px(px(10.))
		.rounded(theme::RADIUS_ITEM)
		.bg(theme::color(theme::SECONDARY))
		.border_1()
		.border_color(hairline())
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_SMALL)
		.child(div().text_color(theme::color(theme::TEXT_FAINT)).child("<"))
		.child(div().text_color(theme::color(color)).child(name))
		.child(div().text_color(theme::color(theme::TEXT_FAINT)).child(">"))
}

impl Workspace {
	pub fn render_inspector(
		&mut self,
		window: &Window,
		cx: &mut Context<Self>,
	) -> impl IntoElement {
		let panel = div()
			.w(px(self.inspector_width(window)))
			.flex_none()
			.h_full()
			.flex()
			.flex_col()
			.bg(theme::color(theme::PANEL));
		let Some(inspection) = self.inspection.as_ref() else {
			return panel.child(centered("Select a Component", theme::TEXT_MUTED));
		};
		let Some(element) = inspection.element.as_ref() else {
			return match &inspection.error {
				Some(error) => panel.child(centered(error.clone(), theme::ERROR)),
				None => panel.child(centered("Inspecting", theme::TEXT_FAINT)),
			};
		};
		let sections = self.render_sections(inspection, element, cx);
		panel
			.child(self.render_header(element, cx))
			.child(SmoothScroll::new(
				"inspector-glide",
				&self.inspector_scroll,
				div()
					.id("inspector-scroll")
					.flex_1()
					.min_h_0()
					.overflow_y_scroll()
					.track_scroll(&self.inspector_scroll)
					.flex()
					.flex_col()
					.gap(px(CARD_GAP))
					.p(px(CARD_GAP))
					.children(sections),
			))
	}

	fn render_header(
		&self,
		element: &InspectedElement,
		cx: &mut Context<Self>,
	) -> impl IntoElement {
		let id = element.id;
		let highlighted = self.highlighted == Some(id);
		let name = match self.devtools.store().get(id) {
			Some(stored) => stored.name.to_string(),
			None => element.name.clone(),
		};
		panel_header()
			.gap(px(6.))
			.child(
				div()
					.flex_none()
					.max_w(px(200.))
					.truncate()
					.text_size(theme::TEXT_TITLE)
					.font_weight(FontWeight::SEMIBOLD)
					.child(name),
			)
			.child(badge(element.kind.label(), theme::TEXT_SECONDARY))
			.when_some(element.key.clone(), |row, key| {
				row.child(
					div()
						.flex()
						.min_w_0()
						.overflow_hidden()
						.font_family(theme::mono_font())
						.text_size(theme::TEXT_SMALL)
						.child(
							div()
								.flex_none()
								.text_color(theme::color(theme::SYN_KEY_ATTR))
								.child("key="),
						)
						.child(
							div()
								.min_w_0()
								.truncate()
								.text_color(theme::color(theme::SYN_KEY_VALUE))
								.child(format!("\"{key}\"")),
						),
				)
			})
			.child(div().flex_1())
			.child(
				div()
					.flex_none()
					.pr(px(4.))
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(theme::TEXT_FAINT))
					.child(format!("#{}", id.0)),
			)
			.child(
				icon_button("highlight", assets::CROSSHAIR, highlighted)
					.tooltip(tooltip(if highlighted {
						"Stop highlighting on device"
					} else {
						"Highlight on device"
					}))
					.on_click(cx.listener(move |this, _, _, cx| this.toggle_highlight(id, cx))),
			)
			.child(
				icon_button("log", assets::TERMINAL, false)
					.tooltip(tooltip("Log to the device console"))
					.on_click(cx.listener(move |this, _, _, cx| this.log_to_console(id, cx))),
			)
	}

	/// One section as a card: a header that folds it, with a count of its entries, over its body.
	fn render_section(
		&self,
		title: &'static str,
		count: usize,
		body: Vec<AnyElement>,
		cx: &mut Context<Self>,
	) -> Option<AnyElement> {
		if body.is_empty() {
			return None;
		}
		let folded = self.folded_sections.contains(title);
		let header = div()
			.id(title)
			.flex_none()
			.flex()
			.items_center()
			.gap(px(4.))
			.h(px(CARD_HEADER_HEIGHT))
			.px(px(8.))
			.cursor_pointer()
			.hover(|header| header.bg(theme::color(theme::HOVER)))
			.child(
				div()
					.flex_none()
					.w(px(theme::CHEVRON_SLOT))
					.flex()
					.justify_center()
					.child(chevron(!folded)),
			)
			.child(
				div()
					.flex_1()
					.text_size(theme::TEXT_SMALL)
					.font_weight(FontWeight::SEMIBOLD)
					.text_color(theme::color(theme::TEXT))
					.child(title),
			)
			.child(
				div()
					.flex_none()
					.text_size(theme::TEXT_EYEBROW)
					.text_color(theme::color(theme::TEXT_MUTED))
					.child(count.to_string()),
			)
			.on_click(cx.listener(move |this, _, _, cx| {
				if !this.folded_sections.remove(title) {
					this.folded_sections.insert(title);
				}
				cx.notify();
			}));
		Some(
			div()
				.flex_none()
				.flex()
				.flex_col()
				.overflow_hidden()
				.rounded(theme::RADIUS_CONTROL)
				.bg(theme::color(theme::ELEVATED))
				.border_1()
				.border_color(hairline())
				.child(header)
				.when(!folded, |card| {
					card.child(
						div()
							.flex()
							.flex_col()
							.py(px(4.))
							.border_t_1()
							.border_color(hairline())
							.children(body),
					)
				})
				.into_any_element(),
		)
	}

	fn render_sections(
		&self,
		inspection: &Inspection,
		element: &InspectedElement,
		cx: &mut Context<Self>,
	) -> Vec<AnyElement> {
		let mut sections = Vec::new();
		for (title, value, section) in [
			("Props", &element.props, "props"),
			("State", &element.state, "state"),
		] {
			let mut rows = Rows::new(inspection, element);
			if let Some(value) = value {
				rows.push_entries(value, vec![key(section)], cx);
			}
			let count = entry_count(value.as_ref());
			sections.extend(self.render_section(title, count, rows.out, cx));
		}

		let mut hooks = Rows::new(inspection, element);
		for (ix, hook) in element.hooks.iter().enumerate() {
			let path: Path = vec![key("hooks"), unbound_devtools_core::PathSegment::Index(ix)];
			hooks.push_hook(hook, path, 0, cx);
		}
		sections.extend(self.render_section("Hooks", element.hooks.len(), hooks.out, cx));

		let mut context = Rows::new(inspection, element);
		if let Some(value) = &element.context {
			context.push_entries(value, vec![key("context")], cx);
		}
		let count = entry_count(element.context.as_ref());
		sections.extend(self.render_section("Context", count, context.out, cx));

		let owners: Vec<AnyElement> = element
			.owners
			.iter()
			.map(|owner| {
				let id = owner.id;
				component_chip(owner.name.clone().into(), owner.kind)
					.id(SharedString::from(format!("owner{}", id.0)))
					.cursor_pointer()
					.hover(|chip| chip.bg(theme::color(theme::SECONDARY_HOVER)))
					.on_click(cx.listener(move |this, _, _, cx| this.select(Some(id), cx)))
					.into_any_element()
			})
			.collect();
		let owner_count = owners.len();
		let owners = if owners.is_empty() {
			Vec::new()
		} else {
			// The chips wrap, nearest owner first, like a breadcrumb read upward.
			vec![
				div()
					.flex()
					.flex_wrap()
					.gap(px(6.))
					.px(px(CARD_GAP))
					.py(px(6.))
					.children(owners)
					.into_any_element(),
			]
		};
		sections.extend(self.render_section("Rendered By", owner_count, owners, cx));

		let source: Vec<AnyElement> = element
			.source
			.iter()
			.map(|source| {
				let mut location = source.file.clone();
				for part in [source.line, source.column].into_iter().flatten() {
					location.push_str(&format!(":{part}"));
				}
				card_row()
					.font_family(theme::mono_font())
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(theme::TEXT_SECONDARY))
					.child(icon("icons/file-code.svg", theme::ICON, theme::TEXT_MUTED))
					.child(
						div()
							.min_w_0()
							.overflow_hidden()
							.text_ellipsis_start()
							.child(location),
					)
					.into_any_element()
			})
			.collect();
		sections.extend(self.render_section("Source", source.len(), source, cx));

		let errors: Vec<AnyElement> = element
			.errors
			.iter()
			.map(|entry| (entry, theme::ERROR))
			.chain(element.warnings.iter().map(|entry| (entry, theme::WARNING)))
			.map(|((message, count), color)| {
				card_row()
					.child(
						div()
							.min_w_0()
							.flex_1()
							.truncate()
							.text_color(theme::color(color))
							.child(message.clone()),
					)
					.when(*count > 1, |row| row.child(badge(count.to_string(), color)))
					.into_any_element()
			})
			.collect();
		sections.extend(self.render_section("Errors", errors.len(), errors, cx));
		sections
	}
}
