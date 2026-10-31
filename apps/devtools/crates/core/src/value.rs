//! Inspected values. The backend dehydrates props, state, hooks and context: objects past a depth
//! become a [`Meta`] placeholder listed in `cleaned`, and values JSON can't carry are listed in
//! `unserializable`. [`Value`] is that tree with placeholders typed, so callers never see the
//! `{data, cleaned, unserializable}` envelope.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use serde_json::{Value as Json, json};

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(untagged)]
pub enum PathSegment {
	Index(usize),
	Key(String),
}

pub type Path = Vec<PathSegment>;

#[derive(Clone, Debug, PartialEq)]
pub enum Value {
	Null,
	Undefined,
	Bool(bool),
	Number(f64),
	String(String),
	Array(Vec<Value>),
	/// Insertion order preserved, as the device enumerates keys.
	Object(Vec<(String, Value)>),
	/// A value the backend did not send in full: a function, a React element, a deep object, a
	/// symbol. `inspectable` ones can be expanded with `Devtools::inspect_path`.
	Dehydrated(Meta),
}

#[derive(Clone, Debug, PartialEq, Serialize)]
pub struct Meta {
	/// The backend's `type`: `function`, `react_element`, `object`, `array`, `symbol`, `date`, ...
	pub kind: String,
	pub name: Option<String>,
	pub preview_short: String,
	pub preview_long: String,
	pub inspectable: bool,
	pub size: Option<usize>,
}

/// The metadata keys of an `unserializable` node; everything else on it is a child value.
const UNSERIALIZABLE_META: [&str; 7] = [
	"unserializable",
	"type",
	"readonly",
	"preview_short",
	"preview_long",
	"name",
	"size",
];

/// Paths compared segment-wise as text: the backend lists an iterator's children by index while
/// the JSON object carries them as string keys.
type PathKey = Vec<String>;

struct Envelope {
	cleaned: HashSet<PathKey>,
	unserializable: HashSet<PathKey>,
}

impl PathSegment {
	fn text(&self) -> String {
		match self {
			Self::Index(index) => index.to_string(),
			Self::Key(key) => key.clone(),
		}
	}
}

impl Value {
	/// Rebuilds a value from the backend's `{data, cleaned, unserializable}` envelope. Anything
	/// else is taken as plain data.
	pub fn from_dehydrated(envelope: &Json) -> Value {
		Self::from_dehydrated_at(envelope, &[])
	}

	/// Like [`Self::from_dehydrated`] for a `hydrated-path` response, whose `cleaned` paths are
	/// absolute (they start with `prefix`, the requested path).
	pub fn from_dehydrated_at(envelope: &Json, prefix: &[PathSegment]) -> Value {
		let Some(data) = envelope.get("data") else {
			return Self::from_json(envelope);
		};
		let prefix: PathKey = prefix.iter().map(PathSegment::text).collect();
		let paths = |key: &str| -> HashSet<PathKey> {
			let Some(Json::Array(paths)) = envelope.get(key) else {
				return HashSet::new();
			};

			paths
				.iter()
				.filter_map(Json::as_array)
				.map(|path| path.iter().map(segment_text).collect::<PathKey>())
				.map(|path| match path.strip_prefix(prefix.as_slice()) {
					Some(relative) => relative.to_vec(),
					None => path,
				})
				.collect()
		};
		let envelope = Envelope {
			cleaned: paths("cleaned"),
			unserializable: paths("unserializable"),
		};

		convert(data, &mut Vec::new(), &envelope)
	}

	/// Plain JSON with no placeholders.
	pub fn from_json(json: &Json) -> Value {
		let empty = Envelope {
			cleaned: HashSet::new(),
			unserializable: HashSet::new(),
		};

		convert(json, &mut Vec::new(), &empty)
	}

	pub fn get(&self, path: &[PathSegment]) -> Option<&Value> {
		let Some((first, rest)) = path.split_first() else {
			return Some(self);
		};

		self.child(first)?.get(rest)
	}

	/// Replaces the node at `path` (used to splice in a `hydrated-path` response). A path that
	/// does not exist is ignored.
	pub fn set(&mut self, path: &[PathSegment], value: Value) {
		let Some((first, rest)) = path.split_first() else {
			*self = value;
			return;
		};

		if let Some(child) = self.child_mut(first) {
			child.set(rest, value);
		}
	}

	/// A one-line preview: `{author: {…}, content: "hello"}`, `ƒ onPress()`, `<View />`.
	pub fn preview(&self, max_chars: usize) -> String {
		let text = match self {
			Self::Array(items) => format!("[{}]", join(items.iter().map(Value::nested_preview))),
			Self::Object(entries) => format!(
				"{{{}}}",
				join(
					entries
						.iter()
						.map(|(key, value)| format!("{key}: {}", value.nested_preview()))
				)
			),
			Self::Dehydrated(meta) => meta.preview_long.clone(),
			scalar => scalar.nested_preview(),
		};

		truncate(text, max_chars)
	}

	/// Plain JSON for jq and MCP output. A placeholder becomes
	/// `{"$type": kind, "$name": name, "$preview": preview_long}`. `undefined` becomes `null` and
	/// non-finite numbers become strings (`"NaN"`).
	pub fn to_json(&self) -> Json {
		match self {
			Self::Null | Self::Undefined => Json::Null,
			Self::Bool(b) => Json::Bool(*b),
			Self::Number(n) => number_json(*n),
			Self::String(s) => Json::String(s.clone()),
			Self::Array(items) => Json::Array(items.iter().map(Value::to_json).collect()),
			Self::Object(entries) => Json::Object(
				entries
					.iter()
					.map(|(key, value)| (key.clone(), value.to_json()))
					.collect(),
			),
			Self::Dehydrated(meta) => json!({
				"$type": meta.kind,
				"$name": meta.name,
				"$preview": meta.preview_long,
			}),
		}
	}

	fn child(&self, segment: &PathSegment) -> Option<&Value> {
		match self {
			Self::Array(items) => items.get(segment_index(segment)?),
			Self::Object(entries) => {
				let key = segment.text();
				entries
					.iter()
					.find(|(k, _)| *k == key)
					.map(|(_, value)| value)
			}
			_ => None,
		}
	}

	fn child_mut(&mut self, segment: &PathSegment) -> Option<&mut Value> {
		match self {
			Self::Array(items) => items.get_mut(segment_index(segment)?),
			Self::Object(entries) => {
				let key = segment.text();
				entries
					.iter_mut()
					.find(|(k, _)| *k == key)
					.map(|(_, value)| value)
			}
			_ => None,
		}
	}

	fn nested_preview(&self) -> String {
		match self {
			Self::Null => "null".to_owned(),
			Self::Undefined => "undefined".to_owned(),
			Self::Bool(b) => b.to_string(),
			Self::Number(n) => format_number(*n),
			Self::String(s) => Json::String(s.clone()).to_string(),
			Self::Array(items) => format!("Array({})", items.len()),
			Self::Object(entries) if entries.is_empty() => "{}".to_owned(),
			Self::Object(_) => "{…}".to_owned(),
			Self::Dehydrated(meta) => meta.preview_short.clone(),
		}
	}
}

fn convert(json: &Json, path: &mut PathKey, envelope: &Envelope) -> Value {
	if envelope.cleaned.contains(path)
		&& let Some(placeholder) = placeholder(json)
	{
		return placeholder;
	}

	match json {
		Json::Null => Value::Null,
		Json::Bool(b) => Value::Bool(*b),
		Json::Number(n) => Value::Number(n.as_f64().unwrap_or(f64::NAN)),
		Json::String(s) => Value::String(s.clone()),
		Json::Array(items) => Value::Array(
			items
				.iter()
				.enumerate()
				.map(|(index, item)| {
					with_segment(path, index.to_string(), |p| convert(item, p, envelope))
				})
				.collect(),
		),
		Json::Object(map) => {
			// An unserializable node (a React element, a class instance) keeps only its children.
			let unserializable = envelope.unserializable.contains(path);

			Value::Object(
				map.iter()
					.filter(|(key, _)| {
						!unserializable || !UNSERIALIZABLE_META.contains(&key.as_str())
					})
					.map(|(key, value)| {
						let child =
							with_segment(path, key.clone(), |p| convert(value, p, envelope));
						(key.clone(), child)
					})
					.collect(),
			)
		}
	}
}

fn placeholder(json: &Json) -> Option<Value> {
	let kind = json.get("type")?.as_str()?;
	let text = |key: &str| {
		json.get(key)
			.and_then(Json::as_str)
			.unwrap_or_default()
			.to_owned()
	};

	Some(match kind {
		"undefined" => Value::Undefined,
		"nan" => Value::Number(f64::NAN),
		"infinity" => Value::Number(f64::INFINITY),
		"-infinity" => Value::Number(f64::NEG_INFINITY),
		_ => Value::Dehydrated(Meta {
			kind: kind.to_owned(),
			name: Some(text("name")).filter(|name| !name.is_empty()),
			preview_short: text("preview_short"),
			preview_long: text("preview_long"),
			inspectable: json
				.get("inspectable")
				.and_then(Json::as_bool)
				.unwrap_or(false),
			size: json
				.get("size")
				.and_then(Json::as_u64)
				.map(|size| size as usize),
		}),
	})
}

fn with_segment<T>(path: &mut PathKey, segment: String, f: impl FnOnce(&mut PathKey) -> T) -> T {
	path.push(segment);
	let out = f(path);
	path.pop();
	out
}

fn segment_text(json: &Json) -> String {
	match json {
		Json::String(s) => s.clone(),
		other => other.to_string(),
	}
}

fn segment_index(segment: &PathSegment) -> Option<usize> {
	match segment {
		PathSegment::Index(index) => Some(*index),
		PathSegment::Key(key) => key.parse().ok(),
	}
}

fn format_number(n: f64) -> String {
	match number_json(n) {
		Json::String(s) => s,
		other => other.to_string(),
	}
}

fn number_json(n: f64) -> Json {
	const MAX_SAFE_INTEGER: f64 = 9_007_199_254_740_991.0;

	if n.is_nan() {
		return Json::String("NaN".to_owned());
	}

	if n.is_infinite() {
		return Json::String(if n > 0.0 { "Infinity" } else { "-Infinity" }.to_owned());
	}

	if n.fract() == 0.0 && n.abs() <= MAX_SAFE_INTEGER {
		return Json::from(n as i64);
	}

	Json::from(n)
}

fn join(parts: impl Iterator<Item = String>) -> String {
	parts.collect::<Vec<_>>().join(", ")
}

fn truncate(text: String, max_chars: usize) -> String {
	if text.chars().count() <= max_chars {
		return text;
	}

	let mut cut: String = text.chars().take(max_chars.saturating_sub(1)).collect();
	cut.push('…');
	cut
}
