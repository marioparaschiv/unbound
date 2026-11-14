//! The inspector's inline editor and the edits it sends: set a value, rename or delete a key, add
//! an entry or item, and force a Suspense or error boundary. Each edit re-inspects the element.

use std::future::Future;

use gpui::{AnyElement, Context, Entity, Subscription, Window, div, prelude::*, px};
use gpui_component::input::{Escape, Input, InputEvent, InputState};
use unbound_devtools_core::{ElementId, Path, PathSegment, RequestError, Value};

use crate::app::{Workspace, on_runtime};
use crate::inspection::{child, splice, value_at};
use crate::react_edit::{edit_target, parse, permissions, stringify};
use crate::{theme, widgets};

/// What the open editor's text becomes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum EditKind {
	/// The value at the path.
	Value,
	/// The key at the end of the path.
	Name,
	/// The key of a new entry in the object at the path.
	NewKey,
	/// The value of the new entry `key` in the object at the path.
	NewValue(String),
	/// A new item at the end of the array at the path.
	NewItem,
}

pub struct Editor {
	pub path: Path,
	pub kind: EditKind,
	pub input: Entity<InputState>,
	/// The text does not parse, or names nothing; Enter keeps the editor open.
	pub invalid: bool,
	_events: Subscription,
}

impl Editor {
	pub fn is(&self, path: &Path, kind: &EditKind) -> bool {
		self.path == *path && self.kind == *kind
	}
}

/// The open editor's field, on a value row's line. Escape closes it unsent.
pub fn edit_field(editor: &Editor, cx: &mut Context<Workspace>) -> AnyElement {
	div()
		.flex_1()
		.min_w(px(80.))
		.on_action(cx.listener(|this, _: &Escape, window, cx| this.close_editor(window, cx)))
		.child(inline_field(Input::new(&editor.input), editor.invalid))
		.into_any_element()
}

/// The `field` well at a value chip's size, so the row keeps its height. Text that does not
/// parse tints it with the error colour, as the toolbar's banner does.
fn inline_field<E: Styled>(input: E, invalid: bool) -> E {
	let input = widgets::field(input)
		.h(px(20.))
		.px(px(6.))
		.rounded(px(5.))
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_MONO);
	if !invalid {
		return input;
	}
	input
		.bg(theme::alpha(theme::ERROR, 0.08))
		.text_color(theme::color(theme::ERROR))
}

impl Workspace {
	/// Opens the inline editor on `path`, replacing any open one. Its text starts as the value or
	/// key it edits, selected.
	pub fn open_editor(
		&mut self,
		path: Path,
		kind: EditKind,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		let Some(inspection) = self.inspection.as_mut() else {
			return;
		};
		let Some(element) = inspection.element.as_ref() else {
			return;
		};
		let text = match (&kind, path.last()) {
			(EditKind::Value, _) => value_at(element, &path).map(stringify).unwrap_or_default(),
			(EditKind::Name, Some(PathSegment::Key(name))) => name.clone(),
			(EditKind::Name, _) => return,
			_ => String::new(),
		};
		let placeholder = match kind {
			EditKind::Name | EditKind::NewKey => "new entry",
			_ => "Enter valid JSON",
		};
		let input = cx.new(|cx| {
			InputState::new(window, cx)
				.placeholder(placeholder)
				.default_value(text)
		});
		input.update(cx, |input, cx| {
			input.focus(window, cx);
			input.select_all(window, cx);
		});
		let events =
			cx.subscribe_in(
				&input,
				window,
				|this, _, event: &InputEvent, window, cx| match event {
					InputEvent::PressEnter { .. } => this.commit_editor(window, cx),
					InputEvent::Change => this.validate_editor(cx),
					// React DevTools applies a value on blur and drops an unfinished key.
					InputEvent::Blur => match this.editor_kind() {
						Some(EditKind::Value) => this.commit_editor(window, cx),
						Some(_) => this.close_editor(window, cx),
						None => {}
					},
					InputEvent::Focus => {}
				},
			);
		inspection.editor = Some(Editor {
			path,
			kind,
			input,
			invalid: false,
			_events: events,
		});
		cx.notify();
	}

	pub fn close_editor(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		let Some(inspection) = self.inspection.as_mut() else {
			return;
		};
		if inspection.editor.take().is_some() {
			window.focus(&self.tree_focus, cx);
			cx.notify();
		}
	}

	fn editor_kind(&self) -> Option<EditKind> {
		Some(self.inspection.as_ref()?.editor.as_ref()?.kind.clone())
	}

	/// Marks a value that does not parse as the user types, as React DevTools does. Keys are only
	/// checked on Enter, so an empty new key does not start out marked.
	fn validate_editor(&mut self, cx: &mut Context<Self>) {
		let Some(editor) = self
			.inspection
			.as_ref()
			.and_then(|inspection| inspection.editor.as_ref())
		else {
			return;
		};
		let invalid = match editor.kind {
			EditKind::Value | EditKind::NewValue(_) | EditKind::NewItem => {
				parse(&editor.input.read(cx).value()).is_none()
			}
			EditKind::Name | EditKind::NewKey => false,
		};
		self.mark_editor(invalid, cx);
	}

	fn mark_editor(&mut self, invalid: bool, cx: &mut Context<Self>) {
		if let Some(editor) = self
			.inspection
			.as_mut()
			.and_then(|inspection| inspection.editor.as_mut())
			&& editor.invalid != invalid
		{
			editor.invalid = invalid;
			cx.notify();
		}
	}

	/// Sends what the editor holds. Text that does not parse keeps it open, marked invalid; a new
	/// entry's key moves on to its value.
	fn commit_editor(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		let Some(inspection) = self.inspection.as_ref() else {
			return;
		};
		let (Some(editor), Some(element)) = (&inspection.editor, &inspection.element) else {
			return;
		};
		let id = inspection.id;
		let text = editor.input.read(cx).value().to_string();
		let path = editor.path.clone();
		match editor.kind.clone() {
			EditKind::Value => {
				let Some(value) = parse(&text) else {
					return self.mark_editor(true, cx);
				};
				let unchanged = value_at(element, &path).map(stringify) == Some(text);
				self.close_editor(window, cx);
				if !unchanged {
					self.set_value(path, value, cx);
				}
			}
			EditKind::Name => {
				let name = text.trim();
				let Some(PathSegment::Key(old)) = path.last() else {
					return;
				};
				if name.is_empty() {
					// Clearing a key deletes its entry, as React DevTools does.
					if !permissions(element, &path).delete {
						return self.mark_editor(true, cx);
					}
					self.close_editor(window, cx);
					return self.delete_value(path, cx);
				}
				if name == old {
					return self.close_editor(window, cx);
				}
				let Some((section, old_path)) = edit_target(element, &path) else {
					return;
				};
				let mut new_path = old_path.clone();
				new_path.pop();
				new_path.push(PathSegment::Key(name.to_owned()));
				self.close_editor(window, cx);
				let devtools = self.devtools.clone();
				self.send_edit(
					id,
					async move { devtools.rename_path(id, section, old_path, new_path).await },
					cx,
				);
			}
			EditKind::NewKey => {
				let name = text.trim();
				if name.is_empty() {
					return self.mark_editor(true, cx);
				}
				self.open_editor(path, EditKind::NewValue(name.to_owned()), window, cx);
			}
			EditKind::NewValue(name) => {
				let Some(value) = parse(&text) else {
					return self.mark_editor(true, cx);
				};
				self.close_editor(window, cx);
				self.set_value(child(&path, PathSegment::Key(name)), value, cx);
			}
			EditKind::NewItem => {
				let Some(value) = parse(&text) else {
					return self.mark_editor(true, cx);
				};
				let Some(Value::Array(items)) = value_at(element, &path) else {
					return;
				};
				let index = items.len();
				self.close_editor(window, cx);
				self.set_value(child(&path, PathSegment::Index(index)), value, cx);
			}
		}
	}

	/// Flips a boolean in place, as React DevTools' checkbox does.
	pub fn toggle_bool(&mut self, path: Path, cx: &mut Context<Self>) {
		let current = self
			.inspection
			.as_ref()
			.and_then(|inspection| value_at(inspection.element.as_ref()?, &path));
		if let Some(Value::Bool(current)) = current {
			let value = Some(serde_json::Value::Bool(!current));
			self.set_value(path, value, cx);
		}
	}

	/// Sets the value at `path` (`None`: undefined), showing it before the device answers.
	fn set_value(&mut self, path: Path, value: Option<serde_json::Value>, cx: &mut Context<Self>) {
		let Some(inspection) = self.inspection.as_mut() else {
			return;
		};
		let id = inspection.id;
		let Some(element) = inspection.element.as_mut() else {
			return;
		};
		let Some((section, target)) = edit_target(element, &path) else {
			return;
		};
		let shown = value.as_ref().map_or(Value::Undefined, Value::from_json);
		splice(element, &path, shown);
		let devtools = self.devtools.clone();
		self.send_edit(
			id,
			async move { devtools.override_value(id, section, target, value).await },
			cx,
		);
	}

	pub fn delete_value(&mut self, path: Path, cx: &mut Context<Self>) {
		let Some(inspection) = self.inspection.as_ref() else {
			return;
		};
		let id = inspection.id;
		let Some(element) = inspection.element.as_ref() else {
			return;
		};
		let Some((section, target)) = edit_target(element, &path) else {
			return;
		};
		let devtools = self.devtools.clone();
		self.send_edit(
			id,
			async move { devtools.delete_path(id, section, target).await },
			cx,
		);
	}

	pub fn toggle_error(&mut self, id: ElementId, errored: bool, cx: &mut Context<Self>) {
		let devtools = self.devtools.clone();
		self.send_edit(
			id,
			async move { devtools.override_error(id, errored).await },
			cx,
		);
	}

	pub fn toggle_suspense(&mut self, id: ElementId, suspended: bool, cx: &mut Context<Self>) {
		let devtools = self.devtools.clone();
		self.send_edit(
			id,
			async move { devtools.override_suspense(id, suspended).await },
			cx,
		);
	}

	/// Runs an edit on the core's runtime, shows a failure in the banner, then re-inspects.
	fn send_edit(
		&mut self,
		id: ElementId,
		edit: impl Future<Output = Result<(), RequestError>> + Send + 'static,
		cx: &mut Context<Self>,
	) {
		let request = on_runtime(&self.devtools, edit);
		cx.spawn(async move |this, cx| {
			let result = request.await;
			this.update(cx, |this, cx| {
				if let Some(Err(error)) = result {
					this.show_error(format!("Failed to edit #{}: {error}", id.0), cx);
				}
				this.inspect(id, cx);
			})
			.ok();
		})
		.detach();
		cx.notify();
	}
}
