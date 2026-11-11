//! A command's options as controls: a text field, a switch, or a segmented choice per schema field.

use std::collections::HashMap;

use gpui::{App, AppContext, Context, Entity, SharedString, Window};
use gpui_component::input::InputState;
use unbound_devtools_core::ubd::{CommandSpec, Field, FieldKind, FieldValue};

/// The field every bridge command takes; the app fills it from the Bridge port setting.
pub const BRIDGE_PORT_FIELD: &str = "port";

pub enum Input {
	Text(Entity<InputState>),
	Bool(bool),
	Choice(Vec<String>, Option<usize>),
}

pub struct Control {
	pub field: Field,
	pub input: Input,
}

/// A camel-case field name in title case: `className` as "Class Name", `authorId` as "Author ID".
pub fn label(name: &str) -> String {
	let mut words: Vec<String> = vec![String::new()];
	for ch in name.chars() {
		if ch.is_ascii_uppercase() {
			words.push(String::new());
		}
		if let Some(word) = words.last_mut() {
			word.push(ch.to_ascii_lowercase());
		}
	}
	let words: Vec<String> = words
		.into_iter()
		.enumerate()
		.map(|(ix, word)| match word.as_str() {
			"ios" => "iOS".to_owned(),
			"id" | "udid" | "url" | "json" => word.to_uppercase(),
			"a" | "an" | "and" | "as" | "by" | "for" | "in" | "of" | "on" | "or" | "the" | "to"
				if ix > 0 =>
			{
				word
			}
			_ => {
				let mut chars = word.chars();
				chars
					.next()
					.map(|first| first.to_uppercase().chain(chars).collect())
					.unwrap_or_default()
			}
		})
		.collect();
	words.join(" ")
}

/// How the field reads on the command line: `<code>` or `--timeout`.
pub fn syntax(field: &Field) -> String {
	if field.positional {
		format!("<{}>", field.name)
	} else {
		field.flag()
	}
}

fn placeholder(field: &Field) -> SharedString {
	let default = field.default_text();
	let text = match (&field.kind, default.is_empty()) {
		(FieldKind::List, true) => "Separate items with commas".to_owned(),
		(FieldKind::List, false) => format!("{default} (separate with commas)"),
		(_, false) => default,
		(_, true) if field.required => "Required".to_owned(),
		(_, true) => "Optional".to_owned(),
	};
	text.into()
}

/// Whether the form shows the field; the bridge port comes from the settings instead.
pub fn is_visible(field: &Field) -> bool {
	!(field.name == BRIDGE_PORT_FIELD
		&& matches!(field.kind, FieldKind::Number | FieldKind::Integer))
}

pub fn build<V: 'static>(
	spec: &CommandSpec,
	window: &mut Window,
	cx: &mut Context<V>,
) -> Vec<Control> {
	spec.fields
		.iter()
		.filter(|field| is_visible(field))
		.map(|field| {
			let input = match &field.kind {
				FieldKind::Bool => Input::Bool(field.default_bool()),
				FieldKind::Choice(choices) => {
					let default = field.default_text();
					let selected = choices.iter().position(|choice| *choice == default);
					Input::Choice(choices.clone(), selected)
				}
				_ => {
					let placeholder = placeholder(field);
					Input::Text(cx.new(|cx| InputState::new(window, cx).placeholder(placeholder)))
				}
			};
			Control {
				field: field.clone(),
				input,
			}
		})
		.collect()
}

pub fn values(controls: &[Control], cx: &App) -> HashMap<String, FieldValue> {
	controls
		.iter()
		.map(|control| {
			let value = match &control.input {
				Input::Text(state) => FieldValue::Text(state.read(cx).value().to_string()),
				Input::Bool(on) => FieldValue::Bool(*on),
				Input::Choice(choices, selected) => FieldValue::Text(
					selected
						.and_then(|ix| choices.get(ix))
						.cloned()
						.unwrap_or_default(),
				),
			};
			(control.field.name.clone(), value)
		})
		.collect()
}

#[cfg(test)]
mod tests {
	use super::label;

	#[test]
	fn labels_read_as_words() {
		assert_eq!(label("className"), "Class Name");
		assert_eq!(label("declaredCapabilities"), "Declared Capabilities");
		assert_eq!(label("pathToFile"), "Path to File");
		assert_eq!(label("ios"), "iOS");
		assert_eq!(label("authorId"), "Author ID");
	}
}
