//! Inspector value rows: `key: preview` lines that expand inline, colored by value type.

use gpui::{AnyElement, Context, SharedString, div, prelude::*, px};
use unbound_devtools_core::{Hook, InspectedElement, Path, PathSegment, Value};

use crate::app::Workspace;
use crate::inspection::{Inspection, child, is_editable, key};
use crate::{theme, widgets};

const PREVIEW_CHARS: usize = 96;

/// The preview text, its color, and whether it is set in italic (functions).
fn preview(value: &Value) -> (String, u32, bool) {
	match value {
		Value::Null | Value::Undefined | Value::Bool(_) => {
			(value.preview(PREVIEW_CHARS), theme::SYN_LITERAL, false)
		}
		Value::Number(_) => (value.preview(PREVIEW_CHARS), theme::SYN_NUMBER, false),
		Value::String(_) => (value.preview(PREVIEW_CHARS), theme::SYN_STRING, false),
		Value::Array(_) | Value::Object(_) => {
			(value.preview(PREVIEW_CHARS), theme::TEXT_SECONDARY, false)
		}
		Value::Dehydrated(meta) => match meta.kind.as_str() {
			"function" => {
				let name = meta.name.as_deref().unwrap_or_default();
				(format!("ƒ {name}()"), theme::SYN_FUNCTION, true)
			}
			"react_element" => (meta.preview_short.clone(), theme::SYN_ELEMENT, false),
			_ => (meta.preview_short.clone(), theme::TEXT_SECONDARY, false),
		},
	}
}

fn is_expandable(value: &Value) -> bool {
	match value {
		Value::Array(items) => !items.is_empty(),
		Value::Object(entries) => !entries.is_empty(),
		Value::Dehydrated(meta) => meta.inspectable,
		_ => false,
	}
}

fn children(value: &Value) -> Vec<(String, PathSegment, &Value)> {
	match value {
		Value::Array(items) => items
			.iter()
			.enumerate()
			.map(|(ix, item)| (ix.to_string(), PathSegment::Index(ix), item))
			.collect(),
		Value::Object(entries) => entries
			.iter()
			.map(|(name, item)| (name.clone(), key(name), item))
			.collect(),
		_ => Vec::new(),
	}
}

fn row_id(path: &Path) -> SharedString {
	format!("value{path:?}").into()
}

/// The fixed chevron slot every value row starts with, so keys line up whether or not they expand.
fn chevron(expandable: bool, expanded: bool) -> impl IntoElement {
	div()
		.flex_none()
		.w(px(theme::INDENT))
		.flex()
		.justify_center()
		.when(expandable, |slot| slot.child(widgets::chevron(expanded)))
}

fn base_row(path: &Path, depth: usize) -> gpui::Stateful<gpui::Div> {
	div()
		.id(row_id(path))
		.flex()
		.items_center()
		.h(theme::VALUE_ROW_HEIGHT)
		.pl(px(theme::INSET + depth as f32 * theme::INDENT))
		.pr(px(theme::INSET))
		.whitespace_nowrap()
		.overflow_hidden()
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_MONO)
		.hover(|row| row.bg(theme::color(theme::HOVER)))
}

pub struct Rows<'a> {
	pub inspection: &'a Inspection,
	pub element: &'a InspectedElement,
	pub out: Vec<AnyElement>,
}

impl<'a> Rows<'a> {
	pub fn new(inspection: &'a Inspection, element: &'a InspectedElement) -> Self {
		Self {
			inspection,
			element,
			out: Vec::new(),
		}
	}

	/// Pushes the children of a section's root value (the props object's keys, say).
	pub fn push_entries(&mut self, root: &Value, path: Path, cx: &mut Context<Workspace>) {
		let entries = children(root);
		if entries.is_empty() {
			self.push_value(None, root, path, 0, cx);
			return;
		}
		for (label, segment, value) in entries {
			self.push_value(Some(label), value, child(&path, segment), 0, cx);
		}
	}

	fn push_value(
		&mut self,
		label: Option<String>,
		value: &Value,
		path: Path,
		depth: usize,
		cx: &mut Context<Workspace>,
	) {
		let expandable = is_expandable(value);
		let expanded = expandable && self.inspection.expanded.contains(&path);
		let (text, color, italic) = preview(value);
		let editable = matches!(value, Value::Bool(_)) && is_editable(self.element, &path);
		let mut row = base_row(&path, depth).child(chevron(expandable, expanded));
		if let Some(label) = label {
			row = row
				.child(
					div()
						.flex_none()
						.text_color(theme::color(theme::SYN_PROP_KEY))
						.child(label),
				)
				.child(
					div()
						.flex_none()
						.text_color(theme::color(theme::TEXT_MUTED))
						.child(": "),
				);
		}
		row = row.child(
			div()
				.min_w_0()
				.truncate()
				.text_color(theme::color(color))
				.when(italic, |text| text.italic())
				.when(editable, |text| {
					text.cursor_pointer().hover(|text| text.underline())
				})
				.child(text),
		);
		let click_path = path.clone();
		if expandable {
			row = row.cursor_pointer().on_click(
				cx.listener(move |this, _, _, cx| this.toggle_value(click_path.clone(), cx)),
			);
		} else if editable {
			row = row.on_click(
				cx.listener(move |this, _, _, cx| this.toggle_bool(click_path.clone(), cx)),
			);
		}
		self.out.push(row.into_any_element());
		if expanded {
			self.push_children(value, &path, depth + 1, cx);
		}
	}

	fn push_children(
		&mut self,
		value: &Value,
		path: &Path,
		depth: usize,
		cx: &mut Context<Workspace>,
	) {
		if matches!(value, Value::Dehydrated(_)) {
			if self.inspection.loading.contains(path) {
				self.out.push(
					base_row(&child(path, key("$loading")), depth)
						.child(chevron(false, false))
						.font_family(theme::ui_font())
						.text_color(theme::color(theme::TEXT_FAINT))
						.child("Loading")
						.into_any_element(),
				);
			}
			return;
		}
		for (label, segment, item) in children(value) {
			self.push_value(Some(label), item, child(path, segment), depth, cx);
		}
	}

	pub fn push_hook(
		&mut self,
		hook: &Hook,
		path: Path,
		depth: usize,
		cx: &mut Context<Workspace>,
	) {
		let value_path = child(&path, key("value"));
		let expandable = !hook.sub_hooks.is_empty() || is_expandable(&hook.value);
		let expanded = expandable && self.inspection.expanded.contains(&value_path);
		let (text, color, italic) = preview(&hook.value);
		let editable =
			matches!(hook.value, Value::Bool(_)) && is_editable(self.element, &value_path);
		let show_value = hook.sub_hooks.is_empty() || !matches!(hook.value, Value::Undefined);
		let click_path = value_path.clone();
		let edit_path = value_path.clone();
		let row = base_row(&path, depth)
			.child(chevron(expandable, expanded))
			.child(
				div()
					.flex_none()
					.min_w(px(16.))
					.pr(px(4.))
					.text_color(theme::color(theme::TEXT_FAINT))
					.children(hook.id.map(|id| id.to_string())),
			)
			.child(
				div()
					.flex_none()
					.text_color(theme::color(theme::SYN_PROP_KEY))
					.child(hook.name.clone()),
			)
			.when(show_value, |row| {
				row.child(
					div()
						.flex_none()
						.text_color(theme::color(theme::TEXT_MUTED))
						.child(": "),
				)
				.child(
					div()
						.min_w_0()
						.truncate()
						.text_color(theme::color(color))
						.when(italic, |text| text.italic())
						.when(editable, |text| {
							text.cursor_pointer().hover(|text| text.underline())
						})
						.child(text),
				)
			})
			.when(expandable, |row| {
				row.cursor_pointer().on_click(
					cx.listener(move |this, _, _, cx| this.toggle_value(click_path.clone(), cx)),
				)
			})
			.when(!expandable && editable, |row| {
				row.on_click(
					cx.listener(move |this, _, _, cx| this.toggle_bool(edit_path.clone(), cx)),
				)
			});
		self.out.push(row.into_any_element());
		if !expanded {
			return;
		}
		if is_expandable(&hook.value) {
			self.push_children(&hook.value, &value_path, depth + 1, cx);
		}
		for (ix, sub_hook) in hook.sub_hooks.iter().enumerate() {
			let sub_path = child(&child(&path, key("subHooks")), PathSegment::Index(ix));
			self.push_hook(sub_hook, sub_path, depth + 1, cx);
		}
	}
}
