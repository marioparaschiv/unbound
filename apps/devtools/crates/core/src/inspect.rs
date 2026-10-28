//! The typed result of `inspectElement`.

use serde::Serialize;
use serde_json::Value as Json;

use crate::store::{ElementId, ElementKind};
use crate::value::Value;

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

impl InspectedElement {
	/// Parses a `full-data` `value`.
	pub fn from_payload(value: &Json) -> anyhow::Result<Self> {
		todo!()
	}

	/// Plain JSON of the whole element, for jq filters and MCP output.
	pub fn to_json(&self) -> Json {
		todo!()
	}
}
