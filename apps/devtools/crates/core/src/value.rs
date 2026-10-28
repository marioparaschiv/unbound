//! Inspected values. The backend dehydrates props, state, hooks and context: objects past a depth
//! become a [`Meta`] placeholder listed in `cleaned`, and values JSON can't carry are listed in
//! `unserializable`. [`Value`] is that tree with placeholders typed, so callers never see the
//! `{data, cleaned, unserializable}` envelope.

use serde::{Deserialize, Serialize};
use serde_json::Value as Json;

#[derive(Clone, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
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

impl Value {
	/// Rebuilds a value from the backend's `{data, cleaned, unserializable}` envelope.
	pub fn from_dehydrated(envelope: &Json) -> Value {
		todo!()
	}

	pub fn get(&self, path: &[PathSegment]) -> Option<&Value> {
		todo!()
	}

	/// Replaces the node at `path` (used to splice in a `hydrated-path` response).
	pub fn set(&mut self, path: &[PathSegment], value: Value) {
		todo!()
	}

	/// A one-line preview: `{author: {…}, content: "hello"}`, `ƒ onPress()`, `<View />`.
	pub fn preview(&self, max_chars: usize) -> String {
		todo!()
	}

	/// Plain JSON for jq and MCP output. A placeholder becomes
	/// `{"$type": kind, "$name": name, "$preview": preview_long}`.
	pub fn to_json(&self) -> Json {
		todo!()
	}
}
