//! The explorer page: a header with back, forward and the breadcrumb, the filter, then the list of
//! the host's cards, the class chain, its sections and their members. Only the rows on screen are
//! drawn.

use gpui::{AnyElement, Context, FontWeight, SharedString, Window, div, list, prelude::*, px};
use gpui_component::input::Input;
use unbound_devtools_core::{ExplorerErrorCode, ExplorerMemberKind, ExplorerTarget};

use super::rows::Item;
use super::{Explorer, ExplorerHost, Load};
use crate::theme;
use crate::widgets::{badge, chevron, field, hairline, icon, icon_button, panel_header, tooltip};

/// Each level of the chain indents by this much: classes, then sections, then members.
pub(super) const LEVEL: f32 = 14.;
const CLASS_ROW_HEIGHT: f32 = 30.;

/// A row's indent for its level of the chain.
pub(super) fn indent(level: u32) -> f32 {
	theme::INSET + level as f32 * LEVEL
}

/// A note in the list, such as a section loading or failing, with an optional action.
pub(super) fn note(
	id: SharedString,
	level: u32,
	text: impl Into<SharedString>,
	tone: theme::Token,
) -> gpui::Stateful<gpui::Div> {
	div()
		.id(id)
		.flex()
		.items_center()
		.gap(px(8.))
		.h(theme::VALUE_ROW_HEIGHT)
		.mx(px(4.))
		.pl(px(indent(level) + theme::CHEVRON_SLOT))
		.pr(px(theme::INSET))
		.rounded(theme::RADIUS_ITEM)
		.text_size(theme::TEXT_SMALL)
		.child(
			div()
				.min_w_0()
				.truncate()
				.text_color(theme::color(tone))
				.child(text.into()),
		)
}

/// A small text button inside a note or a row, such as Retry or Read.
pub(crate) fn link_button(
	id: impl Into<gpui::ElementId>,
	label: &'static str,
) -> gpui::Stateful<gpui::Div> {
	div()
		.id(id)
		.flex_none()
		.px(px(6.))
		.rounded(px(5.))
		.cursor_pointer()
		.text_size(theme::TEXT_SMALL)
		.font_weight(FontWeight::MEDIUM)
		.text_color(theme::color(theme::ACCENT_HOVER))
		.hover(|button| button.bg(theme::color(theme::HOVER)))
		.child(label)
}

/// The short name of a binary image: `UIKitCore` for its framework path.
pub(super) fn image_name(path: &str) -> &str {
	path.rsplit('/').next().unwrap_or(path)
}

impl Explorer {
	pub fn render<H: ExplorerHost>(&self, cx: &mut Context<H>) -> impl IntoElement + use<H> {
		let items = list(
			self.list.clone(),
			cx.processor(|host: &mut H, ix: usize, window, cx| {
				let item = if matches!(host.explorer().items.get(ix), Some(Item::Prelude)) {
					host.prelude(window, cx)
						.unwrap_or_else(|| div().into_any_element())
				} else {
					host.explorer().render_item(ix, window, cx)
				};
				// A list item sizes to its content; the rows span the pane.
				div().w_full().child(item).into_any_element()
			}),
		)
		.flex_1()
		.pb(px(10.));
		div()
			.flex_1()
			.min_h_0()
			.flex()
			.flex_col()
			.child(self.render_header(cx))
			.child(
				div()
					.flex_none()
					.px(px(10.))
					.py(px(8.))
					.border_b_1()
					.border_color(theme::color(theme::BORDER))
					.child(field(
						Input::new(&self.filter_input)
							.prefix(icon(crate::assets::SEARCH, theme::ICON, theme::TEXT_MUTED))
							.cleanable(true),
					)),
			)
			.child(items)
	}

	fn render_header<H: ExplorerHost>(&self, cx: &mut Context<H>) -> impl IntoElement + use<H> {
		let trail: Vec<String> = self.history.trail().map(|entry| entry.title()).collect();
		let last = trail.len().saturating_sub(1);
		let object_ref = self.object_ref().map(str::to_owned);
		let back = self.history.can_go_back();
		let forward = self.history.can_go_forward();
		let crumbs = trail.into_iter().enumerate().flat_map(|(ix, title)| {
			let separator = (ix > 0).then(|| {
				div()
					.flex_none()
					.text_color(theme::color(theme::TEXT_FAINT))
					.child("›")
					.into_any_element()
			});
			let current = ix == last;
			let crumb = div()
				.id(("explorer-crumb", ix))
				.min_w(px(24.))
				.flex_shrink(1.)
				.truncate()
				.font_family(theme::mono_font())
				.text_size(theme::TEXT_SMALL)
				.map(|crumb| {
					if current {
						crumb
							.flex_none()
							.font_weight(FontWeight::SEMIBOLD)
							.text_color(theme::color(theme::TEXT))
					} else {
						crumb
							.cursor_pointer()
							.text_color(theme::color(theme::TEXT_MUTED))
							.hover(|crumb| crumb.text_color(theme::color(theme::TEXT)))
							.on_click(cx.listener(move |host: &mut H, _, _, cx| {
								host.explorer_mut().go_to(ix, cx);
							}))
					}
				})
				.child(title)
				.into_any_element();
			separator.into_iter().chain([crumb])
		});
		panel_header()
			.gap(px(6.))
			.pl(px(6.))
			.child(
				icon_button("explorer-back", "icons/arrow-left.svg", false)
					.when(!back, |button| button.opacity(0.4))
					.tooltip(tooltip("Back"))
					.on_click(cx.listener(|host: &mut H, _, _, cx| host.explorer_mut().back(cx))),
			)
			.child(
				icon_button("explorer-forward", "icons/arrow-right.svg", false)
					.when(!forward, |button| button.opacity(0.4))
					.tooltip(tooltip("Forward"))
					.on_click(
						cx.listener(|host: &mut H, _, _, cx| host.explorer_mut().forward(cx)),
					),
			)
			.child(
				div()
					.flex_1()
					.min_w_0()
					.flex()
					.items_center()
					.gap(px(6.))
					.overflow_hidden()
					.children(crumbs),
			)
			.children(object_ref.map(|object_ref| {
				div()
					.flex_none()
					.pr(px(4.))
					.font_family(theme::mono_font())
					.text_size(theme::TEXT_EYEBROW)
					.text_color(theme::color(theme::TEXT_FAINT))
					.child(format!("ref {object_ref}"))
			}))
	}

	fn render_item<H: ExplorerHost>(
		&self,
		ix: usize,
		window: &mut Window,
		cx: &mut Context<H>,
	) -> AnyElement {
		let Some(item) = self.items.get(ix) else {
			return div().into_any_element();
		};
		match item {
			Item::Prelude => div().into_any_element(),
			Item::Notice => self.render_notice(cx),
			Item::Description => self.render_description(),
			Item::Class { index } => self.render_class(*index, cx),
			Item::Section { class, kind } => self.render_section(ix, class, *kind, cx),
			Item::Member { class, kind, index } => {
				self.render_member(ix, class, *kind, *index, window, cx)
			}
			Item::Note { class, kind } => self.render_note(ix, class, *kind, cx),
			Item::More { class, kind } => self.render_more(ix, class, *kind, cx),
		}
	}

	/// What the page says above the chain: it is loading, it failed, or it fell back to the class.
	fn render_notice<H: ExplorerHost>(&self, cx: &mut Context<H>) -> AnyElement {
		let (tone, title, body, retry): (_, &str, SharedString, _) = match &self.object {
			Some(Load::Failed(error)) => {
				let title = match error.code() {
					Some(ExplorerErrorCode::Disabled) => "The Inspector Is Off",
					Some(ExplorerErrorCode::Unavailable) => "The Inspector Did Not Load",
					Some(ExplorerErrorCode::Unsupported) => "Not Supported Here",
					Some(ExplorerErrorCode::UnknownClass) => "No Such Class",
					_ => "Can't Read the Object",
				};
				(theme::ERROR, title, error.to_string().into(), true)
			}
			Some(Load::Loaded(_)) if self.fell_back => (
				theme::WARNING,
				"Object Gone After Reload",
				"Showing its class; values are off until you select it again.".into(),
				false,
			),
			_ => (
				theme::TEXT_FAINT,
				"Reading the Object",
				"Asking the device for its classes.".into(),
				false,
			),
		};
		div()
			.mx(px(10.))
			.mt(px(10.))
			.px(px(12.))
			.py(px(10.))
			.flex()
			.flex_col()
			.gap(px(4.))
			.rounded(theme::RADIUS_CONTROL)
			.bg(theme::alpha(tone, 0.08))
			.border_1()
			.border_color(theme::alpha(tone, 0.25))
			.child(
				div()
					.flex()
					.items_center()
					.gap(px(8.))
					.child(
						div()
							.flex_1()
							.text_size(theme::TEXT_SMALL)
							.font_weight(FontWeight::SEMIBOLD)
							.text_color(theme::color(if tone == theme::TEXT_FAINT {
								theme::TEXT_SECONDARY
							} else {
								tone
							}))
							.child(title),
					)
					.when(retry, |row| {
						row.child(link_button("explorer-retry", "Retry").on_click(
							cx.listener(|host: &mut H, _, _, cx| host.explorer_mut().reload(cx)),
						))
					}),
			)
			.child(
				div()
					.text_size(theme::TEXT_SMALL)
					.line_height(px(18.))
					.text_color(theme::color(theme::TEXT_SECONDARY))
					.child(body),
			)
			.into_any_element()
	}

	fn render_description(&self) -> AnyElement {
		let text = self
			.object()
			.and_then(|object| object.description.clone())
			.unwrap_or_default();
		div()
			.mx(px(10.))
			.mt(px(10.))
			.mb(px(4.))
			.px(px(12.))
			.py(px(8.))
			.rounded(theme::RADIUS_CONTROL)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(hairline())
			.font_family(theme::mono_font())
			.text_size(theme::TEXT_SMALL)
			.line_height(px(18.))
			.text_color(theme::color(theme::TEXT_SECONDARY))
			.child(text)
			.into_any_element()
	}

	fn render_class<H: ExplorerHost>(&self, index: usize, cx: &mut Context<H>) -> AnyElement {
		let Some(object) = self.object() else {
			return div().into_any_element();
		};
		let Some(class) = object.chain.get(index) else {
			return div().into_any_element();
		};
		let expanded = self.expanded.contains(&class.name);
		let summary = self
			.kinds_of(index)
			.into_iter()
			.map(|kind| kind.count(class.counts[&kind]))
			.collect::<Vec<_>>()
			.join(" · ");
		let summary = if summary.is_empty() {
			"declares nothing".to_owned()
		} else {
			summary
		};
		let own_page = matches!(
			self.history.current().map(|entry| &entry.target),
			Some(ExplorerTarget::ClassName(name)) if *name == class.name
		);
		let name = class.name.clone();
		div()
			.id(("explorer-class", index))
			.flex()
			.items_center()
			.gap(px(6.))
			.h(px(CLASS_ROW_HEIGHT))
			.mx(px(4.))
			.mt(px(if index == 0 { 6. } else { 2. }))
			.pl(px(indent(0)))
			.pr(px(4.))
			.rounded(theme::RADIUS_ITEM)
			.cursor_pointer()
			.hover(|row| row.bg(theme::color(theme::HOVER)))
			.group("explorer-class")
			.child(
				div()
					.flex_none()
					.w(px(theme::CHEVRON_SLOT))
					.flex()
					.justify_center()
					.child(chevron(expanded)),
			)
			.child(
				div()
					.flex_none()
					.max_w(px(220.))
					.truncate()
					.font_family(theme::mono_font())
					.text_size(theme::TEXT_MONO)
					.font_weight(FontWeight::SEMIBOLD)
					.text_color(theme::color(if index == 0 {
						theme::SYN_COMPONENT
					} else {
						theme::TEXT_SECONDARY
					}))
					.child(class.name.clone()),
			)
			.children(
				class
					.image
					.as_deref()
					.map(|image| badge(image_name(image).to_owned(), theme::TEXT_MUTED)),
			)
			.child(
				div()
					.flex_1()
					.min_w_0()
					.truncate()
					.text_right()
					.text_size(theme::TEXT_EYEBROW)
					.text_color(theme::color(theme::TEXT_FAINT))
					.child(summary),
			)
			// Keeps the counts lined up with the rows that have the open button.
			.when(own_page, |row| row.child(div().flex_none().size(px(22.))))
			.when(!own_page, |row| {
				let name = name.clone();
				row.child(
					icon_button(
						("explorer-open-class", index),
						"icons/arrow-up-right.svg",
						false,
					)
					.size(px(22.))
					.tooltip(tooltip("Open this class"))
					.on_click(cx.listener(move |host: &mut H, _, _, cx| {
						cx.stop_propagation();
						host.explorer_mut()
							.push(super::Entry::class(name.clone()), cx);
					})),
				)
			})
			.on_click(cx.listener(move |host: &mut H, _, _, cx| {
				host.explorer_mut().toggle_class(&name, cx)
			}))
			.into_any_element()
	}

	fn render_section<H: ExplorerHost>(
		&self,
		ix: usize,
		class: &str,
		kind: ExplorerMemberKind,
		cx: &mut Context<H>,
	) -> AnyElement {
		let open = self.open.contains(&(class.to_owned(), kind));
		let declared = self
			.object()
			.and_then(|object| object.chain.iter().find(|item| item.name == class))
			.and_then(|item| item.counts.get(&kind).copied())
			.unwrap_or(0);
		// Filtered, the count is how many match, once the device says.
		let count = match (self.filter.is_empty(), self.section(class, kind)) {
			(false, Some(Load::Loaded(section))) => format!("{} of {declared}", section.total),
			_ => declared.to_string(),
		};
		let class = class.to_owned();
		div()
			.id(("explorer-section", ix))
			.flex()
			.items_center()
			.gap(px(6.))
			.h(theme::VALUE_ROW_HEIGHT)
			.mx(px(4.))
			.pl(px(indent(1)))
			.pr(px(theme::INSET))
			.rounded(theme::RADIUS_ITEM)
			.cursor_pointer()
			.hover(|row| row.bg(theme::color(theme::HOVER)))
			.child(
				div()
					.flex_none()
					.w(px(theme::CHEVRON_SLOT))
					.flex()
					.justify_center()
					.child(chevron(open)),
			)
			.child(
				div()
					.flex_none()
					.text_size(theme::TEXT_SMALL)
					.font_weight(FontWeight::MEDIUM)
					.text_color(theme::color(theme::TEXT_SECONDARY))
					.child(kind.label()),
			)
			.child(badge(count, theme::TEXT_MUTED))
			.on_click(cx.listener(move |host: &mut H, _, _, cx| {
				host.explorer_mut().toggle_section(&class, kind, cx);
			}))
			.into_any_element()
	}
}
