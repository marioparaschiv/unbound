//! The right-hand inspector: header, actions, and the collapsible value sections.

use gpui::{AnyElement, Context, FontWeight, SharedString, div, prelude::*, px};
use unbound_devtools_core::{ElementKind, InspectedElement, Path};

use crate::app::Workspace;
use crate::inspection::{Inspection, key};
use crate::theme;
use crate::values::Rows;
use crate::widgets::{button, eyebrow, pill};

fn centered(text: impl Into<SharedString>, color: u32) -> gpui::Div {
	div()
		.flex_1()
		.flex()
		.items_center()
		.justify_center()
		.px(px(24.))
		.text_color(theme::color(color))
		.child(text.into())
}

fn mono_row(depth: f32) -> gpui::Div {
	div()
		.flex()
		.items_center()
		.gap(px(6.))
		.min_h(px(20.))
		.pl(px(24. + depth))
		.pr(px(12.))
		.whitespace_nowrap()
		.overflow_hidden()
}

impl Workspace {
	pub fn render_inspector(&mut self, cx: &mut Context<Self>) -> impl IntoElement {
		let panel = div()
			.w(px(self.inspector_width))
			.flex_none()
			.h_full()
			.flex()
			.flex_col()
			.bg(theme::color(theme::PANEL));
		let Some(inspection) = self.inspection.as_ref() else {
			return panel.child(centered("Select a component", theme::TEXT_MUTED));
		};
		let Some(element) = inspection.element.as_ref() else {
			return match &inspection.error {
				Some(error) => panel.child(centered(error.clone(), theme::ERROR)),
				None => panel.child(centered("Inspecting…", theme::TEXT_FAINT)),
			};
		};
		let sections = self.render_sections(inspection, element, cx);
		panel.child(self.render_header(element, cx)).child(
			div()
				.id("inspector-scroll")
				.flex_1()
				.min_h_0()
				.overflow_y_scroll()
				.pb(px(12.))
				.font_family(theme::mono_font())
				.text_size(theme::TEXT_MONO)
				.children(sections),
		)
	}

	fn render_header(
		&self,
		element: &InspectedElement,
		cx: &mut Context<Self>,
	) -> impl IntoElement {
		let id = element.id;
		let highlighted = self.highlighted == Some(id);
		// The store's name is authoritative; an inspection can arrive without one.
		let name = match self.devtools.store().get(id) {
			Some(stored) => stored.name.to_string(),
			None => element.name.clone(),
		};
		div()
			.flex_none()
			.flex()
			.flex_col()
			.gap(px(8.))
			.px(px(12.))
			.py(px(12.))
			.border_b_1()
			.border_color(theme::color(theme::BORDER))
			.child(
				div()
					.flex()
					.items_center()
					.gap(px(8.))
					.min_w_0()
					.child(
						div()
							.min_w_0()
							.truncate()
							.text_size(theme::TEXT_TITLE)
							.font_weight(FontWeight::SEMIBOLD)
							.child(name),
					)
					.child(pill(
						element.kind.label(),
						theme::TEXT_SECONDARY,
						theme::color(theme::SYN_HOC_BG),
					))
					.when_some(element.key.clone(), |row, key| {
						row.child(
							div()
								.flex()
								.min_w_0()
								.truncate()
								.font_family(theme::mono_font())
								.text_size(theme::TEXT_SMALL)
								.child(
									div()
										.text_color(theme::color(theme::SYN_KEY_ATTR))
										.child("key="),
								)
								.child(
									div()
										.text_color(theme::color(theme::SYN_KEY_VALUE))
										.child(format!("\"{key}\"")),
								),
						)
					})
					.child(div().flex_1())
					.child(
						div()
							.flex_none()
							.font_family(theme::mono_font())
							.text_size(theme::TEXT_SMALL)
							.text_color(theme::color(theme::TEXT_FAINT))
							.child(format!("#{}", id.0)),
					),
			)
			.child(
				div()
					.flex()
					.gap(px(8.))
					.child(
						button("highlight", "Highlight", highlighted).on_click(
							cx.listener(move |this, _, _, cx| this.toggle_highlight(id, cx)),
						),
					)
					.child(
						button("log", "Log to console", false).on_click(
							cx.listener(move |this, _, _, cx| this.log_to_console(id, cx)),
						),
					),
			)
	}

	fn render_section(
		&self,
		title: &'static str,
		rows: Vec<AnyElement>,
		cx: &mut Context<Self>,
	) -> Option<AnyElement> {
		if rows.is_empty() {
			return None;
		}
		let folded = self.folded_sections.contains(title);
		let header = div()
			.id(title)
			.flex()
			.items_center()
			.h(px(28.))
			.mt(px(4.))
			.px(px(12.))
			.font_family(theme::ui_font())
			.cursor_pointer()
			.child(
				div()
					.w(px(12.))
					.text_size(px(10.))
					.text_color(theme::color(theme::TEXT_FAINT))
					.child(if folded { "▸" } else { "▾" }),
			)
			.child(eyebrow(title))
			.on_click(cx.listener(move |this, _, _, cx| {
				if !this.folded_sections.remove(title) {
					this.folded_sections.insert(title);
				}
				cx.notify();
			}));
		Some(
			div()
				.child(header)
				.when(!folded, |section| section.children(rows))
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
			sections.extend(self.render_section(title, rows.out, cx));
		}

		let mut hooks = Rows::new(inspection, element);
		for (ix, hook) in element.hooks.iter().enumerate() {
			let path: Path = vec![key("hooks"), unbound_devtools_core::PathSegment::Index(ix)];
			hooks.push_hook(hook, path, 0, cx);
		}
		sections.extend(self.render_section("Hooks", hooks.out, cx));

		let mut context = Rows::new(inspection, element);
		if let Some(value) = &element.context {
			context.push_entries(value, vec![key("context")], cx);
		}
		sections.extend(self.render_section("Context", context.out, cx));

		let owners = element
			.owners
			.iter()
			.map(|owner| {
				let id = owner.id;
				let color = if owner.kind == ElementKind::Host {
					theme::SYN_HOST
				} else {
					theme::SYN_COMPONENT
				};
				mono_row(0.)
					.id(SharedString::from(format!("owner{}", id.0)))
					.cursor_pointer()
					.hover(|row| row.bg(theme::color(theme::HOVER)))
					.child(
						div()
							.flex()
							.child(div().text_color(theme::color(theme::TEXT_FAINT)).child("<"))
							.child(
								div()
									.text_color(theme::color(color))
									.child(owner.name.clone()),
							)
							.child(div().text_color(theme::color(theme::TEXT_FAINT)).child(">")),
					)
					.on_click(cx.listener(move |this, _, _, cx| this.select(Some(id), cx)))
					.into_any_element()
			})
			.collect();
		sections.extend(self.render_section("Rendered by", owners, cx));

		let source = element
			.source
			.iter()
			.map(|source| {
				let mut location = source.file.clone();
				for part in [source.line, source.column].into_iter().flatten() {
					location.push_str(&format!(":{part}"));
				}
				mono_row(0.)
					.text_color(theme::color(theme::TEXT_SECONDARY))
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
		sections.extend(self.render_section("Source", source, cx));

		let errors = element
			.errors
			.iter()
			.map(|entry| (entry, theme::ERROR))
			.chain(element.warnings.iter().map(|entry| (entry, theme::WARNING)))
			.map(|((message, count), color)| {
				mono_row(0.)
					.child(
						div()
							.min_w_0()
							.flex_1()
							.truncate()
							.text_color(theme::color(color))
							.child(message.clone()),
					)
					.when(*count > 1, |row| {
						row.child(pill(count.to_string(), color, theme::alpha(color, 0.14)))
					})
					.into_any_element()
			})
			.collect();
		sections.extend(self.render_section("Errors", errors, cx));
		sections
	}
}
