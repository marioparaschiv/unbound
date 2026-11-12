//! A member's row: its name and type, its value on the object when the device can read it, and a
//! button that copies it as plugin code. Object and class values are links that open their page.

use gpui::{AnyElement, Context, FontWeight, SharedString, Window, div, prelude::*, px};
use unbound_devtools_core::{
	EXPLORER_MEMBERS_PAGE_SIZE, ExplorerMember, ExplorerMemberKind, ExplorerRead, ExplorerTarget,
	ExplorerValue, ExplorerValueKind,
};

use super::render::{indent, link_button, note};
use super::{Entry, Explorer, ExplorerHost, Load, ValueState, snippets};
use crate::copy_glyph::{copied_state, copy_glyphs, copy_on_click, element_id};
use crate::theme::{self, Token};
use crate::widgets::{badge, text_tooltip, tooltip};

/// Lets a row's copy button show while the pointer is anywhere on the row.
const ROW_GROUP: &str = "explorer-member";
const VALUE_WIDTH: f32 = 220.;

fn name_tone(kind: ExplorerMemberKind) -> Token {
	match kind {
		ExplorerMemberKind::Properties | ExplorerMemberKind::Fields => theme::SYN_PROP_KEY,
		ExplorerMemberKind::Ivars => theme::SYN_KEY_ATTR,
		ExplorerMemberKind::Methods
		| ExplorerMemberKind::ClassMethods
		| ExplorerMemberKind::Constructors => theme::SYN_FUNCTION,
		ExplorerMemberKind::Protocols | ExplorerMemberKind::Interfaces => theme::SYN_COMPONENT,
	}
}

/// What a row names: a method's declaration, which shows its types, or the member's name.
fn label(member: &ExplorerMember) -> String {
	match member.kind {
		ExplorerMemberKind::Methods
		| ExplorerMemberKind::ClassMethods
		| ExplorerMemberKind::Constructors => member.signature.clone().unwrap_or_else(|| {
			let parameters = member.parameters.as_deref().unwrap_or_default().join(", ");
			match &member.return_type {
				Some(returns) => format!("{returns} {}({parameters})", member.name),
				None => format!("{}({parameters})", member.name),
			}
		}),
		_ => member.name.clone(),
	}
}

fn value_text(text: impl Into<SharedString>, tone: Token) -> gpui::Div {
	div()
		.flex_none()
		.max_w(px(VALUE_WIDTH))
		.truncate()
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_SMALL)
		.text_color(theme::color(tone))
		.child(text.into())
}

impl Explorer {
	pub(super) fn render_member<H: ExplorerHost>(
		&self,
		ix: usize,
		class: &str,
		kind: ExplorerMemberKind,
		index: usize,
		window: &mut Window,
		cx: &mut Context<H>,
	) -> AnyElement {
		let Some(member) = self.member(class, kind, index).cloned() else {
			return div().into_any_element();
		};
		let label = label(&member);
		let ty = match kind {
			ExplorerMemberKind::Properties
			| ExplorerMemberKind::Ivars
			| ExplorerMemberKind::Fields => member.ty.clone(),
			_ => None,
		};
		let code = self
			.object()
			.and_then(|object| snippets::plugin_code(object.platform, class, &member));
		div()
			.id(("explorer-member", ix))
			.group(ROW_GROUP)
			.flex()
			.items_center()
			.gap(px(8.))
			.h(theme::VALUE_ROW_HEIGHT)
			.mx(px(4.))
			.pl(px(indent(2) + 6.))
			.pr(px(4.))
			.rounded(theme::RADIUS_ITEM)
			.hover(|row| row.bg(theme::color(theme::HOVER)))
			.tooltip(text_tooltip(
				member.signature.clone().unwrap_or_else(|| label.clone()),
			))
			.child(
				// No minimum width, which would pad a short name; the type gives way first.
				div()
					.flex_shrink(1.)
					.min_w_0()
					.truncate()
					.font_family(theme::mono_font())
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(name_tone(kind)))
					.child(label),
			)
			.when(member.is_static(), |row| {
				row.child(badge("static", theme::TEXT_MUTED))
			})
			.children(ty.map(|ty| {
				div()
					.flex_shrink(4.)
					.min_w_0()
					.truncate()
					.font_family(theme::mono_font())
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(theme::TEXT_FAINT))
					.child(ty)
			}))
			.child(div().flex_1())
			.children(self.render_value(class, &member, cx))
			.children(code.map(|code| copy_button(class, &member, code, window, cx)))
			.into_any_element()
	}

	/// The member's value on the object: read, reading, a Read button for a getter that runs code,
	/// or nothing on a class page.
	fn render_value<H: ExplorerHost>(
		&self,
		class: &str,
		member: &ExplorerMember,
		cx: &mut Context<H>,
	) -> Option<AnyElement> {
		if !member.kind.has_values() {
			return None;
		}
		self.object_ref()?;
		let key = (class.to_owned(), member.kind, member.name.clone());
		let element = match (member.read, self.values.get(&key)) {
			(ExplorerRead::Never, _) => {
				value_text("unsafe to read", theme::TEXT_FAINT).into_any_element()
			}
			(ExplorerRead::Manual, None) => {
				let (class, kind, name) = key;
				link_button(
					SharedString::from(format!("explorer-read-{class}-{name}")),
					"Read",
				)
				.tooltip(tooltip("Runs the getter on the device"))
				.on_click(cx.listener(move |host: &mut H, _, _, cx| {
					host.explorer_mut().read_value(&class, kind, &name, cx);
				}))
				.into_any_element()
			}
			(_, None | Some(ValueState::Loading)) => {
				value_text("…", theme::TEXT_FAINT).into_any_element()
			}
			(_, Some(ValueState::Failed(error))) => {
				value_text(error.clone(), theme::ERROR).into_any_element()
			}
			(_, Some(ValueState::Loaded(value))) => value_cell(value, cx),
		};
		Some(element)
	}

	pub(super) fn render_note<H: ExplorerHost>(
		&self,
		ix: usize,
		class: &str,
		kind: ExplorerMemberKind,
		cx: &mut Context<H>,
	) -> AnyElement {
		let id = SharedString::from(format!("explorer-note-{ix}"));
		match self.section(class, kind) {
			Some(Load::Failed(error)) => {
				let class = class.to_owned();
				note(id, 2, error.to_string(), theme::ERROR)
					.child(
						link_button(("explorer-retry-section", ix), "Retry").on_click(cx.listener(
							move |host: &mut H, _, _, cx| {
								host.explorer_mut().retry_section(&class, kind, cx)
							},
						)),
					)
					.into_any_element()
			}
			Some(Load::Loaded(_)) if self.filter.is_empty() => {
				note(id, 2, "None", theme::TEXT_FAINT).into_any_element()
			}
			Some(Load::Loaded(_)) => {
				note(id, 2, "No matches", theme::TEXT_FAINT).into_any_element()
			}
			_ => note(id, 2, "Loading", theme::TEXT_FAINT).into_any_element(),
		}
	}

	pub(super) fn render_more<H: ExplorerHost>(
		&self,
		ix: usize,
		class: &str,
		kind: ExplorerMemberKind,
		cx: &mut Context<H>,
	) -> AnyElement {
		let Some(Load::Loaded(section)) = self.section(class, kind) else {
			return div().into_any_element();
		};
		let remaining = section.total.saturating_sub(section.members.len() as u32);
		let (text, tone, loading) = match &section.next {
			Some(Ok(())) => ("Loading".to_owned(), theme::TEXT_FAINT, true),
			Some(Err(error)) => (format!("{error} Click to try again."), theme::ERROR, false),
			None => (
				format!(
					"Show {} more · {remaining} not listed",
					remaining.min(EXPLORER_MEMBERS_PAGE_SIZE)
				),
				theme::ACCENT_HOVER,
				false,
			),
		};
		let class = class.to_owned();
		note(
			SharedString::from(format!("explorer-more-{ix}")),
			2,
			text,
			tone,
		)
		.when(!loading, |row| {
			row.cursor_pointer()
				.hover(|row| row.bg(theme::color(theme::HOVER)))
				.on_click(cx.listener(move |host: &mut H, _, _, cx| {
					host.explorer_mut().show_more(&class, kind, cx);
				}))
		})
		.into_any_element()
	}
}

/// A read value, coloured by kind; an object or a class is a link to its page.
fn value_cell<H: ExplorerHost>(value: &ExplorerValue, cx: &mut Context<H>) -> AnyElement {
	let entry = match value.kind {
		ExplorerValueKind::Object => value
			.object
			.clone()
			.map(|object| Entry::new(ExplorerTarget::Object(object), value.class_name.clone())),
		ExplorerValueKind::Class => Some(Entry::class(
			value
				.class_name
				.clone()
				.unwrap_or_else(|| value.text.clone()),
		)),
		_ => None,
	};
	let (text, tone) = match value.kind {
		ExplorerValueKind::Nil => ("nil".to_owned(), theme::SYN_LITERAL),
		ExplorerValueKind::Bool => (value.text.clone(), theme::SYN_LITERAL),
		ExplorerValueKind::Number | ExplorerValueKind::Struct => {
			(value.text.clone(), theme::SYN_NUMBER)
		}
		ExplorerValueKind::String => (format!("\"{}\"", value.text), theme::SYN_STRING),
		ExplorerValueKind::Skipped => (value.text.clone(), theme::TEXT_FAINT),
		ExplorerValueKind::Error => (value.text.clone(), theme::ERROR),
		ExplorerValueKind::Object | ExplorerValueKind::Class => (
			value
				.class_name
				.clone()
				.unwrap_or_else(|| value.text.clone()),
			theme::ACCENT_HOVER,
		),
		_ => (value.text.clone(), theme::TEXT_SECONDARY),
	};
	let cell = value_text(text, tone);
	let Some(entry) = entry else {
		return cell.into_any_element();
	};
	div()
		.id(SharedString::from(format!(
			"explorer-link-{}-{}",
			value.name,
			value.text.len()
		)))
		.flex_none()
		.flex()
		.items_center()
		.gap(px(4.))
		.cursor_pointer()
		.rounded(px(5.))
		.px(px(4.))
		.font_weight(FontWeight::MEDIUM)
		.hover(|link| link.bg(theme::alpha(theme::ACCENT, 0.15)))
		.child(cell)
		.child(
			div()
				.flex_none()
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::ACCENT_HOVER))
				.child("→"),
		)
		.on_click(cx.listener(move |host: &mut H, _, _, cx| {
			host.explorer_mut().push(entry.clone(), cx);
		}))
		.into_any_element()
}

/// Copies the member as plugin code; it shows while the pointer is on its row.
fn copy_button<H: ExplorerHost>(
	class: &str,
	member: &ExplorerMember,
	code: String,
	window: &mut Window,
	cx: &mut Context<H>,
) -> AnyElement {
	let id = format!("explorer-copy-{class}-{:?}-{}", member.kind, member.name);
	let state = copied_state(&id, window, cx);
	let showing = state.read(cx).showing;
	div()
		.id(element_id(&id, "button"))
		.flex_none()
		.size(px(22.))
		.flex()
		.items_center()
		.justify_center()
		.rounded(px(6.))
		.cursor_pointer()
		.opacity(if showing { 1. } else { 0. })
		.group_hover(ROW_GROUP, |button| button.opacity(1.))
		.hover(|button| button.bg(theme::color(theme::SECONDARY_HOVER)))
		.tooltip(tooltip("Copy as plugin code"))
		.child(copy_glyphs(&id, 13., theme::TEXT_MUTED, showing))
		.on_click(copy_on_click(state, window.current_view(), code.into()))
		.into_any_element()
}
