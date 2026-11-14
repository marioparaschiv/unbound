//! What the inspector lets the user change, mirroring React DevTools' `KeyValue`: which values are
//! editable, deletable and renamable, where an edit lands on device, and how typed text parses.

use serde_json::Value as Json;
use unbound_devtools_core::{ElementKind, InspectedElement, Path, PathSegment, Section, Value};

use crate::inspection::{hook_at, split_value};

/// What one value row allows. `path` is the inspector's: the section first, a hook's `value` key
/// included.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Permissions {
	/// Set the value, or add entries to it when it is an object or array.
	pub edit: bool,
	pub delete: bool,
	pub rename: bool,
}

/// React DevTools' rules per section: props follow the backend's flags (always for classes, never
/// for Suspense or Activity), state is editable except on host components, context only on class
/// and function components and below its `value` wrapper for renames, and a hook only when it is
/// stateful. No section's root can be deleted or renamed, nor can an array index be renamed.
pub fn permissions(element: &InspectedElement, path: &[PathSegment]) -> Permissions {
	let [PathSegment::Key(section), rest @ ..] = path else {
		return Permissions::default();
	};
	let (edit, delete, rename, tail, rename_depth) = match section.as_str() {
		"props" => (
			element.can_edit_props
				&& !matches!(element.kind, ElementKind::Suspense | ElementKind::Activity),
			element.can_delete_prop_paths,
			element.can_rename_prop_paths,
			rest,
			1,
		),
		"state" => {
			let editable = element.kind != ElementKind::Host;
			(editable, editable, editable, rest, 1)
		}
		"context" => {
			let editable = matches!(element.kind, ElementKind::Class | ElementKind::Function);
			(editable, editable, editable, rest, 2)
		}
		"hooks" => {
			let Some((hook, rest)) = hook_at(&element.hooks, rest) else {
				return Permissions::default();
			};
			let Some(tail) = split_value(rest) else {
				return Permissions::default();
			};
			let stateful = hook.id.is_some() && hook.editable;
			(
				stateful && element.can_edit_hooks,
				stateful && element.can_delete_hook_paths,
				stateful && element.can_rename_hook_paths,
				tail,
				1,
			)
		}
		_ => return Permissions::default(),
	};

	Permissions {
		edit,
		delete: edit && delete && !tail.is_empty(),
		rename: edit
			&& rename && tail.len() >= rename_depth
			&& matches!(tail.last(), Some(PathSegment::Key(_))),
	}
}

/// Where an inspector path lands on device: its section, and the path inside it. A hook's path
/// starts with its hook id in place of the hook's position and `value` key.
pub fn edit_target(element: &InspectedElement, path: &[PathSegment]) -> Option<(Section, Path)> {
	let (PathSegment::Key(section), rest) = path.split_first()? else {
		return None;
	};
	let section = Section::from_label(section)?;
	if section != Section::Hooks {
		return Some((section, rest.to_vec()));
	}
	let (hook, rest) = hook_at(&element.hooks, rest)?;
	let mut target = vec![PathSegment::Index(hook.id? as usize)];
	target.extend_from_slice(split_value(rest)?);
	Some((section, target))
}

/// A value the inline editor edits as text; objects and arrays are edited entry by entry.
pub fn is_scalar(value: &Value) -> bool {
	matches!(
		value,
		Value::Null | Value::Undefined | Value::Bool(_) | Value::Number(_) | Value::String(_)
	)
}

/// React DevTools' `smartStringify`: JSON, with `undefined` and `NaN` spelled out.
pub fn stringify(value: &Value) -> String {
	value.preview(usize::MAX)
}

/// React DevTools' `smartParse`: JSON, a `'single quoted'` string, or `undefined` (`Some(None)`).
/// `None` when the text is none of those. `NaN` and `Infinity` are refused: the bridge carries JSON.
pub fn parse(text: &str) -> Option<Option<Json>> {
	let text = text.trim();
	if text == "undefined" {
		return Some(None);
	}
	let single_quoted = text
		.strip_prefix('\'')
		.and_then(|inner| inner.strip_suffix('\''));
	let parsed = match single_quoted {
		Some(inner) => serde_json::from_str(&format!("\"{inner}\"")),
		None => serde_json::from_str(text),
	};
	parsed.ok().map(Some)
}

#[cfg(test)]
mod tests {
	use serde_json::json;
	use unbound_devtools_core::{ElementId, Hook};

	use super::*;

	fn key(name: &str) -> PathSegment {
		PathSegment::Key(name.into())
	}

	fn element(kind: ElementKind) -> InspectedElement {
		InspectedElement {
			id: ElementId(1),
			name: String::new(),
			key: None,
			kind,
			props: None,
			state: None,
			hooks: vec![
				Hook {
					id: Some(0),
					name: "State".into(),
					value: Value::Object(vec![("open".into(), Value::Bool(true))]),
					sub_hooks: Vec::new(),
					editable: true,
				},
				Hook {
					id: None,
					name: "Context".into(),
					value: Value::String("dark".into()),
					sub_hooks: Vec::new(),
					editable: false,
				},
			],
			context: None,
			owners: Vec::new(),
			source: None,
			errors: Vec::new(),
			warnings: Vec::new(),
			renderer: None,
			can_edit_hooks: true,
			can_edit_props: kind == ElementKind::Class,
			can_delete_hook_paths: true,
			can_rename_hook_paths: true,
			can_delete_prop_paths: kind == ElementKind::Class,
			can_rename_prop_paths: kind == ElementKind::Class,
			can_toggle_error: false,
			can_toggle_suspense: false,
			is_errored: false,
			is_suspended: false,
			has_legacy_context: false,
		}
	}

	#[test]
	fn parses_like_react_devtools() {
		assert_eq!(parse("42"), Some(Some(json!(42))));
		assert_eq!(parse("'hi'"), Some(Some(json!("hi"))));
		assert_eq!(parse(r#"{"a": [1]}"#), Some(Some(json!({ "a": [1] }))));
		assert_eq!(parse("undefined"), Some(None));
		assert_eq!(parse("hi"), None);
		assert_eq!(parse("NaN"), None);
	}

	#[test]
	fn stringifies_scalars_for_editing() {
		assert_eq!(stringify(&Value::String("a\"b".into())), r#""a\"b""#);
		assert_eq!(stringify(&Value::Undefined), "undefined");
		assert_eq!(stringify(&Value::Number(1.5)), "1.5");
	}

	#[test]
	fn class_props_and_state_allow_every_edit_below_the_root() {
		let class = element(ElementKind::Class);
		let all = Permissions {
			edit: true,
			delete: true,
			rename: true,
		};
		assert_eq!(permissions(&class, &[key("props"), key("title")]), all);
		assert_eq!(permissions(&class, &[key("state"), key("count")]), all);
		assert_eq!(
			permissions(&class, &[key("props")]),
			Permissions {
				edit: true,
				..Default::default()
			}
		);
		assert!(!permissions(&class, &[key("props"), key("items"), PathSegment::Index(0)]).rename);
	}

	#[test]
	fn function_props_follow_the_backend_flags() {
		let function = element(ElementKind::Function);
		assert_eq!(
			permissions(&function, &[key("props"), key("title")]),
			Permissions::default()
		);
		assert!(!permissions(&element(ElementKind::Host), &[key("state"), key("x")]).edit);
	}

	#[test]
	fn context_renames_only_below_its_value_wrapper() {
		let class = element(ElementKind::Class);
		let wrapper = permissions(&class, &[key("context"), key("value")]);
		let inner = permissions(&class, &[key("context"), key("value"), key("theme")]);
		assert!(wrapper.edit && wrapper.delete && !wrapper.rename);
		assert!(inner.rename);
	}

	#[test]
	fn only_stateful_hooks_edit_and_land_on_their_hook_id() {
		let function = element(ElementKind::Function);
		let open = [
			key("hooks"),
			PathSegment::Index(0),
			key("value"),
			key("open"),
		];
		let root = [key("hooks"), PathSegment::Index(0), key("value")];
		let context = [key("hooks"), PathSegment::Index(1), key("value")];

		assert!(permissions(&function, &open).rename);
		assert_eq!(
			permissions(&function, &root),
			Permissions {
				edit: true,
				..Default::default()
			}
		);
		assert_eq!(permissions(&function, &context), Permissions::default());
		assert_eq!(
			edit_target(&function, &open),
			Some((Section::Hooks, vec![PathSegment::Index(0), key("open")]))
		);
		assert_eq!(edit_target(&function, &context), None);
	}
}
