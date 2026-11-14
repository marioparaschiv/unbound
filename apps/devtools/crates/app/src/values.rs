use gpui::{AnyElement, Context, SharedString, div, prelude::*, px};
use unbound_devtools_core::{Hook, InspectedElement, Path, PathSegment, Value};

use crate::app::Workspace;
use crate::inspection::{Inspection, child, key};
use crate::react_edit::{Permissions, is_scalar, permissions};
use crate::value_editor::{EditKind, edit_field};
use crate::{theme, widgets};

const PREVIEW_CHARS: usize = 96;
/// The hover group of a value row, which reveals its delete button.
const ROW_GROUP: &str = "value-row";

struct Preview {
	text: String,
	color: theme::Token,
	italic: bool,
}

impl Preview {
	fn plain(text: String, color: theme::Token) -> Self {
		Self {
			text,
			color,
			italic: false,
		}
	}
}

fn preview(value: &Value) -> Preview {
	match value {
		Value::Null | Value::Undefined | Value::Bool(_) => {
			Preview::plain(value.preview(PREVIEW_CHARS), theme::SYN_LITERAL)
		}
		Value::Number(_) => Preview::plain(value.preview(PREVIEW_CHARS), theme::SYN_NUMBER),
		Value::String(_) => Preview::plain(value.preview(PREVIEW_CHARS), theme::SYN_STRING),
		Value::Array(_) | Value::Object(_) => {
			Preview::plain(value.preview(PREVIEW_CHARS), theme::TEXT_SECONDARY)
		}
		Value::Dehydrated(meta) => match meta.kind.as_str() {
			"function" => {
				let name = meta.name.as_deref().unwrap_or_default();
				Preview {
					text: format!("ƒ {name}()"),
					color: theme::SYN_FUNCTION,
					italic: true,
				}
			}
			"react_element" => Preview::plain(meta.preview_short.clone(), theme::SYN_ELEMENT),
			_ => Preview::plain(meta.preview_short.clone(), theme::TEXT_SECONDARY),
		},
	}
}

/// Opens to list its children, or, when it can be edited, to add the first one.
fn is_expandable(value: &Value, editable: bool) -> bool {
	match value {
		Value::Array(items) => editable || !items.is_empty(),
		Value::Object(entries) => editable || !entries.is_empty(),
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

fn row_id(prefix: &str, path: &Path) -> SharedString {
	format!("{prefix}{path:?}").into()
}

fn chevron(expandable: bool, expanded: bool) -> impl IntoElement {
	div()
		.flex_none()
		.w(px(theme::CHEVRON_SLOT))
		.flex()
		.justify_center()
		.when(expandable, |slot| slot.child(widgets::chevron(expanded)))
}

/// A value row inside an inspector card: inset 4px so its hover sits inside the card's rim, with
/// the label on the card rows' 12px line plus one indent per level.
fn base_row(path: &Path, depth: usize) -> gpui::Stateful<gpui::Div> {
	div()
		.id(row_id("value", path))
		.group(ROW_GROUP)
		.flex()
		.items_center()
		.h(theme::VALUE_ROW_HEIGHT)
		.mx(px(4.))
		.rounded(theme::RADIUS_ITEM - px(2.))
		.pl(px(4. + depth as f32 * theme::INDENT))
		.pr(px(8.))
		.whitespace_nowrap()
		.overflow_hidden()
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_MONO)
		.hover(|row| row.bg(theme::color(theme::HOVER)))
}

fn separator() -> gpui::Div {
	div()
		.flex_none()
		.text_color(theme::color(theme::TEXT_MUTED))
		.child(": ")
}

/// A value's preview. An editable one sits on a small raised chip, so it reads as a control
/// before it is hovered.
fn value_text(text: String, color: theme::Token, italic: bool, editable: bool) -> gpui::Div {
	div()
		.min_w_0()
		.truncate()
		.text_color(theme::color(color))
		.when(italic, |text| text.italic())
		.when(editable, |text| {
			text.flex_none()
				.px(px(6.))
				.rounded(px(5.))
				.bg(theme::color(theme::SECONDARY))
				.border_1()
				.border_color(widgets::hairline())
				.cursor_pointer()
				.hover(|text| text.bg(theme::color(theme::SECONDARY_HOVER)))
		})
		.child(text)
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

	fn editing(&self, path: &Path, kind: &EditKind) -> bool {
		self.inspection
			.editor
			.as_ref()
			.is_some_and(|editor| editor.is(path, kind))
	}

	fn field(&self, cx: &mut Context<Workspace>) -> AnyElement {
		match &self.inspection.editor {
			Some(editor) => edit_field(editor, cx),
			None => div().into_any_element(),
		}
	}

	/// A section's top-level entries. `addable` ends them with an "Add entry" row when the section
	/// is editable, which stands in for an empty root's `{}`.
	pub fn push_entries(
		&mut self,
		root: &Value,
		path: Path,
		addable: bool,
		cx: &mut Context<Workspace>,
	) {
		let addable =
			addable && matches!(root, Value::Object(_)) && permissions(self.element, &path).edit;
		let entries = children(root);
		if entries.is_empty() && !addable {
			self.push_value(None, root, path, 0, cx);
			return;
		}
		for (label, segment, value) in entries {
			self.push_value(Some(label), value, child(&path, segment), 0, cx);
		}
		if addable {
			self.push_add(&path, false, 0, cx);
		}
	}

	/// The key, editable in place when it can be renamed.
	fn label(
		&self,
		label: String,
		path: &Path,
		allowed: Permissions,
		cx: &mut Context<Workspace>,
	) -> AnyElement {
		if self.editing(path, &EditKind::Name) {
			return self.field(cx);
		}
		let name = div()
			.id(row_id("name", path))
			.flex_none()
			.text_color(theme::color(theme::SYN_PROP_KEY))
			.child(label);
		if !allowed.rename {
			return name.into_any_element();
		}
		let path = path.clone();
		name.cursor_text()
			.on_click(cx.listener(move |this, _, window, cx| {
				cx.stop_propagation();
				this.open_editor(path.clone(), EditKind::Name, window, cx);
			}))
			.into_any_element()
	}

	/// The row's trailing delete button, shown while the row is hovered.
	fn delete_button(path: &Path, cx: &mut Context<Workspace>) -> impl IntoElement {
		let target = path.clone();
		div().flex_1().flex().justify_end().child(
			div()
				.id(row_id("delete", path))
				.flex_none()
				.size(px(20.))
				.flex()
				.items_center()
				.justify_center()
				.rounded(px(5.))
				.opacity(0.)
				.group_hover(ROW_GROUP, |button| button.opacity(1.))
				.hover(|button| button.bg(theme::color(theme::SECONDARY_HOVER)))
				.cursor_pointer()
				.tooltip(widgets::tooltip("Delete entry"))
				.child(widgets::icon("icons/trash.svg", px(12.), theme::TEXT_MUTED))
				.on_click(cx.listener(move |this, _, _, cx| {
					cx.stop_propagation();
					this.delete_value(target.clone(), cx);
				})),
		)
	}

	fn push_value(
		&mut self,
		label: Option<String>,
		value: &Value,
		path: Path,
		depth: usize,
		cx: &mut Context<Workspace>,
	) {
		let allowed = permissions(self.element, &path);
		let expandable = is_expandable(value, allowed.edit);
		let expanded = expandable && self.inspection.expanded.contains(&path);
		let Preview {
			text,
			color,
			italic,
		} = preview(value);
		let editable = allowed.edit && is_scalar(value);
		// A click inside an open field must not reopen it or fold the row.
		let editing = self.editing(&path, &EditKind::Value) || self.editing(&path, &EditKind::Name);
		let mut row = base_row(&path, depth).child(chevron(expandable, expanded));
		if let Some(label) = label {
			row = row
				.child(self.label(label, &path, allowed, cx))
				.child(separator());
		}
		if editing && !self.editing(&path, &EditKind::Name) {
			row = row.child(self.field(cx));
		} else {
			row = row.child(value_text(text, color, italic, editable));
		}
		if allowed.delete {
			row = row.child(Self::delete_button(&path, cx));
		}
		let click_path = path.clone();
		if expandable && !editing {
			row = row.cursor_pointer().on_click(
				cx.listener(move |this, _, _, cx| this.toggle_value(click_path.clone(), cx)),
			);
		} else if editable && !editing {
			let is_bool = matches!(value, Value::Bool(_));
			row = row.on_click(cx.listener(move |this, _, window, cx| {
				if is_bool {
					this.toggle_bool(click_path.clone(), cx);
				} else {
					this.open_editor(click_path.clone(), EditKind::Value, window, cx);
				}
			}));
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
		if permissions(self.element, path).edit {
			self.push_add(path, matches!(value, Value::Array(_)), depth, cx);
		}
	}

	/// The last row of an editable object or array: a prompt that opens an editor for a new entry
	/// (key, then value) or a new item.
	pub fn push_add(
		&mut self,
		path: &Path,
		array: bool,
		depth: usize,
		cx: &mut Context<Workspace>,
	) {
		let pending = self
			.inspection
			.editor
			.as_ref()
			.and_then(|editor| (editor.path == *path).then_some(editor.kind.clone()));
		let row = base_row(&child(path, key("$add")), depth).child(chevron(false, false));
		let row = match pending {
			Some(EditKind::NewKey | EditKind::NewItem) => row.child(self.field(cx)),
			Some(EditKind::NewValue(name)) => row
				.child(
					div()
						.flex_none()
						.text_color(theme::color(theme::SYN_PROP_KEY))
						.child(name),
				)
				.child(separator())
				.child(self.field(cx)),
			_ => {
				let kind = if array {
					EditKind::NewItem
				} else {
					EditKind::NewKey
				};
				let path = path.clone();
				row.cursor_pointer()
					.font_family(theme::ui_font())
					.text_color(theme::color(theme::TEXT_FAINT))
					.child(widgets::icon("icons/plus.svg", px(12.), theme::TEXT_FAINT))
					.child(
						div()
							.ml(px(4.))
							.child(if array { "Add item" } else { "Add entry" }),
					)
					.on_click(cx.listener(move |this, _, window, cx| {
						this.open_editor(path.clone(), kind.clone(), window, cx);
					}))
			}
		};
		self.out.push(row.into_any_element());
	}

	pub fn push_hook(
		&mut self,
		hook: &Hook,
		path: Path,
		depth: usize,
		cx: &mut Context<Workspace>,
	) {
		let value_path = child(&path, key("value"));
		let allowed = permissions(self.element, &value_path);
		let expandable = !hook.sub_hooks.is_empty() || is_expandable(&hook.value, allowed.edit);
		let expanded = expandable && self.inspection.expanded.contains(&value_path);
		let Preview {
			text,
			color,
			italic,
		} = preview(&hook.value);
		let editable = allowed.edit && is_scalar(&hook.value);
		let show_value = hook.sub_hooks.is_empty() || !matches!(hook.value, Value::Undefined);
		let click_path = value_path.clone();
		let edit_path = value_path.clone();
		let is_bool = matches!(hook.value, Value::Bool(_));
		let editing = self.editing(&value_path, &EditKind::Value);
		let value = if editing {
			self.field(cx)
		} else {
			value_text(text, color, italic, editable).into_any_element()
		};
		let row = base_row(&path, depth)
			.child(chevron(expandable, expanded))
			// The slot stays for a hook with no id (`useContext`), so every hook name starts on one line.
			.child(
				div()
					.flex_none()
					.mr(px(6.))
					.min_w(px(18.))
					.h(px(18.))
					.flex()
					.items_center()
					.justify_center()
					.rounded(px(5.))
					.text_size(theme::TEXT_EYEBROW)
					.text_color(theme::color(theme::TEXT_MUTED))
					.when_some(hook.id, |slot, id| {
						slot.bg(theme::color(theme::SECONDARY))
							.child(id.to_string())
					}),
			)
			.child(
				div()
					.flex_none()
					.text_color(theme::color(theme::SYN_PROP_KEY))
					.child(hook.name.clone()),
			)
			.when(show_value, |row| row.child(separator()).child(value))
			.when(expandable, |row| {
				row.cursor_pointer().on_click(
					cx.listener(move |this, _, _, cx| this.toggle_value(click_path.clone(), cx)),
				)
			})
			.when(!expandable && editable && !editing, |row| {
				row.on_click(cx.listener(move |this, _, window, cx| {
					if is_bool {
						this.toggle_bool(edit_path.clone(), cx);
					} else {
						this.open_editor(edit_path.clone(), EditKind::Value, window, cx);
					}
				}))
			});
		self.out.push(row.into_any_element());
		if !expanded {
			return;
		}
		if is_expandable(&hook.value, allowed.edit) {
			self.push_children(&hook.value, &value_path, depth + 1, cx);
		}
		for (ix, sub_hook) in hook.sub_hooks.iter().enumerate() {
			let sub_path = child(&child(&path, key("subHooks")), PathSegment::Index(ix));
			self.push_hook(sub_hook, sub_path, depth + 1, cx);
		}
	}
}
