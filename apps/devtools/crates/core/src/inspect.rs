//! The typed result of `inspectElement`.

use serde::Serialize;
use serde_json::{Value as Json, json};

use crate::store::{ElementId, ElementKind, split_hocs};
use crate::value::{PathSegment, Value};

#[derive(Clone, Debug)]
pub struct InspectedElement {
	pub id: ElementId,
	pub name: String,
	pub key: Option<String>,
	pub kind: ElementKind,
	pub props: Option<Value>,
	pub state: Option<Value>,
	pub hooks: Vec<Hook>,
	pub context: Option<Value>,
	/// "Rendered by", nearest owner first.
	pub owners: Vec<OwnerRef>,
	pub source: Option<Source>,
	pub errors: Vec<(String, u32)>,
	pub warnings: Vec<(String, u32)>,
	/// `react-native-renderer@19.2.3`.
	pub renderer: Option<String>,
	pub can_edit_hooks: bool,
	pub can_edit_props: bool,
}

#[derive(Clone, Debug)]
pub struct Hook {
	/// Set for stateful hooks; the `hookID` an override targets.
	pub id: Option<u32>,
	pub name: String,
	pub value: Value,
	pub sub_hooks: Vec<Hook>,
	pub editable: bool,
}

#[derive(Clone, Debug, Serialize)]
pub struct OwnerRef {
	pub id: ElementId,
	pub name: String,
	pub kind: ElementKind,
}

#[derive(Clone, Debug, Serialize)]
pub struct Source {
	pub file: String,
	pub line: Option<u32>,
	pub column: Option<u32>,
}

/// The sections an inspector shows and an override can target.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Section {
	Props,
	State,
	Hooks,
	Context,
}

impl Section {
	pub fn label(self) -> &'static str {
		match self {
			Self::Props => "props",
			Self::State => "state",
			Self::Hooks => "hooks",
			Self::Context => "context",
		}
	}

	pub fn from_label(label: &str) -> Option<Self> {
		[Self::Props, Self::State, Self::Hooks, Self::Context]
			.into_iter()
			.find(|section| section.label() == label)
	}
}

#[derive(Debug, thiserror::Error)]
#[error("inspectedElement payload has no numeric `id`")]
pub struct PayloadError;

impl InspectedElement {
	/// Parses a `full-data` `value`. `name` is left empty: the backend does not send it, the
	/// session fills it from the store.
	pub fn from_payload(value: &Json) -> anyhow::Result<Self> {
		let id = value.get("id").and_then(Json::as_i64).ok_or(PayloadError)?;
		let kind = ElementKind::from_wire(value.get("type").and_then(Json::as_i64).unwrap_or(9));
		let hooks = section(value, "hooks")
			.map(|hooks| hooks_from_value(&hooks))
			.unwrap_or_default();
		let flag = |key: &str| value.get(key).and_then(Json::as_bool).unwrap_or(false);
		let renderer = match (
			str_field(value, "rendererPackageName"),
			str_field(value, "rendererVersion"),
		) {
			(Some(name), Some(version)) => Some(format!("{name}@{version}")),
			(name, _) => name,
		};

		Ok(Self {
			id: ElementId(id),
			name: String::new(),
			key: str_field(value, "key"),
			kind,
			props: section(value, "props"),
			state: section(value, "state"),
			hooks,
			context: section(value, "context"),
			owners: owners(value),
			source: source(value),
			errors: messages(value, "errors"),
			warnings: messages(value, "warnings"),
			renderer,
			can_edit_hooks: flag("canEditHooks"),
			can_edit_props: kind == ElementKind::Class || flag("canEditFunctionProps"),
		})
	}

	/// The value a section path points at: `["props", "author"]`, `["hooks", 0, "value"]`.
	pub fn value_at(&self, path: &[PathSegment]) -> Option<Value> {
		let (PathSegment::Key(section), rest) = path.split_first()? else {
			return None;
		};

		match Section::from_label(section)? {
			Section::Props => self.props.as_ref()?.get(rest).cloned(),
			Section::State => self.state.as_ref()?.get(rest).cloned(),
			Section::Context => self.context.as_ref()?.get(rest).cloned(),
			Section::Hooks => hooks_to_value(&self.hooks).get(rest).cloned(),
		}
	}

	/// Splices a hydrated value in at a section path (see [`Self::value_at`]).
	pub fn set_value_at(&mut self, path: &[PathSegment], value: Value) {
		let Some((PathSegment::Key(section), rest)) = path.split_first() else {
			return;
		};

		let target = match Section::from_label(section) {
			Some(Section::Props) => self.props.as_mut(),
			Some(Section::State) => self.state.as_mut(),
			Some(Section::Context) => self.context.as_mut(),
			Some(Section::Hooks) => {
				let mut hooks = hooks_to_value(&self.hooks);
				hooks.set(rest, value);
				self.hooks = hooks_from_value(&hooks);
				return;
			}
			None => None,
		};

		if let Some(target) = target {
			target.set(rest, value);
		}
	}

	/// Plain JSON of the whole element, for jq filters and MCP output.
	pub fn to_json(&self) -> Json {
		let value_json = |value: &Option<Value>| value.as_ref().map_or(Json::Null, Value::to_json);
		let messages_json = |messages: &[(String, u32)]| -> Json {
			messages
				.iter()
				.map(|(message, count)| json!({ "message": message, "count": count }))
				.collect()
		};

		json!({
			"id": self.id,
			"name": self.name,
			"key": self.key,
			"kind": self.kind,
			"props": value_json(&self.props),
			"state": value_json(&self.state),
			"hooks": self.hooks.iter().map(Hook::to_json).collect::<Vec<_>>(),
			"context": value_json(&self.context),
			"owners": self.owners,
			"source": self.source,
			"errors": messages_json(&self.errors),
			"warnings": messages_json(&self.warnings),
			"renderer": self.renderer,
			"canEditHooks": self.can_edit_hooks,
			"canEditProps": self.can_edit_props,
		})
	}
}

impl Hook {
	fn to_json(&self) -> Json {
		json!({
			"id": self.id,
			"name": self.name,
			"value": self.value.to_json(),
			"subHooks": self.sub_hooks.iter().map(Hook::to_json).collect::<Vec<_>>(),
			"editable": self.editable,
		})
	}
}

fn section(value: &Json, key: &str) -> Option<Value> {
	value
		.get(key)
		.filter(|section| !section.is_null())
		.map(Value::from_dehydrated)
}

fn str_field(value: &Json, key: &str) -> Option<String> {
	value.get(key).and_then(Json::as_str).map(str::to_owned)
}

/// The hooks tree arrives as one dehydrated array of `{id, name, value, subHooks, isStateEditable}`.
fn hooks_from_value(value: &Value) -> Vec<Hook> {
	let Value::Array(items) = value else {
		return Vec::new();
	};

	items
		.iter()
		.map(|item| Hook {
			id: match item.get(&[PathSegment::Key("id".into())]) {
				Some(Value::Number(n)) if *n >= 0.0 => Some(*n as u32),
				_ => None,
			},
			name: match item.get(&[PathSegment::Key("name".into())]) {
				Some(Value::String(name)) => name.clone(),
				_ => String::new(),
			},
			value: item
				.get(&[PathSegment::Key("value".into())])
				.cloned()
				.unwrap_or(Value::Undefined),
			sub_hooks: item
				.get(&[PathSegment::Key("subHooks".into())])
				.map(hooks_from_value)
				.unwrap_or_default(),
			editable: matches!(
				item.get(&[PathSegment::Key("isStateEditable".into())]),
				Some(Value::Bool(true))
			),
		})
		.collect()
}

/// The inverse of [`hooks_from_value`], in the backend's shape, so hook paths address it.
fn hooks_to_value(hooks: &[Hook]) -> Value {
	Value::Array(
		hooks
			.iter()
			.map(|hook| {
				Value::Object(vec![
					(
						"id".into(),
						hook.id
							.map_or(Value::Null, |id| Value::Number(f64::from(id))),
					),
					("isStateEditable".into(), Value::Bool(hook.editable)),
					("name".into(), Value::String(hook.name.clone())),
					("value".into(), hook.value.clone()),
					("subHooks".into(), hooks_to_value(&hook.sub_hooks)),
				])
			})
			.collect(),
	)
}

fn owners(value: &Json) -> Vec<OwnerRef> {
	let Some(Json::Array(owners)) = value.get("owners") else {
		return Vec::new();
	};

	owners
		.iter()
		.filter_map(|owner| {
			let id = owner.get("id")?.as_i64()?;
			let kind =
				ElementKind::from_wire(owner.get("type").and_then(Json::as_i64).unwrap_or(9));
			let display_name = owner
				.get("displayName")
				.and_then(Json::as_str)
				.unwrap_or("Anonymous");

			Some(OwnerRef {
				id: ElementId(id),
				name: split_hocs(display_name).0.to_string(),
				kind,
			})
		})
		.collect()
}

/// `source` is `[functionName, fileName, line, column]` in v6+. When the backend has none (React
/// Native release builds, test renderers) the first owner-stack frame with a file stands in.
fn source(value: &Json) -> Option<Source> {
	let frame = |frame: &Json| -> Option<Source> {
		let file = frame.get(1)?.as_str().filter(|file| !file.is_empty())?;
		let number = |index: usize| frame.get(index).and_then(Json::as_u64).map(|n| n as u32);

		Some(Source {
			file: file.to_owned(),
			line: number(2),
			column: number(3),
		})
	};

	if let Some(source) = value.get("source").and_then(frame) {
		return Some(source);
	}

	value.get("stack")?.as_array()?.iter().find_map(frame)
}

fn messages(value: &Json, key: &str) -> Vec<(String, u32)> {
	let Some(Json::Array(entries)) = value.get(key) else {
		return Vec::new();
	};

	entries
		.iter()
		.filter_map(|entry| {
			let message = entry.get(0)?.as_str()?.to_owned();
			let count = entry.get(1).and_then(Json::as_u64).unwrap_or(1) as u32;

			Some((message, count))
		})
		.collect()
}
