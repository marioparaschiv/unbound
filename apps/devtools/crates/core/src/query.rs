//! Finding elements: the `findInReactTree` of this app.
//!
//! Two layers. [`find`] filters the tree by name, key, kind and subtree with no device round trip.
//! [`JqFilter`] runs a jq program (via jaq) over the tree as JSON, or over inspected props, so
//! `.. | objects | select(.name == "MessageRow" and .key != null) | .id` works as an agent expects.

use serde_json::Value as Json;

use crate::store::{ElementId, ElementKind, Store};

#[derive(Clone, Debug)]
pub enum NameMatch {
	Exact(String),
	/// Case-insensitive substring; what the search box does.
	Contains(String),
	Regex(regex::Regex),
}

#[derive(Clone, Debug, Default)]
pub struct FindQuery {
	pub name: Option<NameMatch>,
	pub key: Option<String>,
	pub kinds: Vec<ElementKind>,
	/// Only descendants of this element.
	pub within: Option<ElementId>,
	pub limit: Option<usize>,
}

/// Matching ids in tree (preorder) order.
pub fn find(store: &Store, query: &FindQuery) -> Vec<ElementId> {
	todo!()
}

/// The tree as nested JSON: `{id, name, kind, key, hocs, errors, warnings, children: [...]}`.
/// `max_depth` counts from `root`; elements past it carry `"truncated": <descendant count>`.
pub fn tree_json(store: &Store, root: Option<ElementId>, max_depth: Option<u32>) -> Json {
	todo!()
}

/// An indented text outline for agents: `  <MessageRow key="m1"> #42 memo`.
/// Stops after `max_nodes` lines and says how many it left out.
pub fn tree_text(
	store: &Store,
	root: Option<ElementId>,
	max_depth: Option<u32>,
	max_nodes: usize,
) -> String {
	todo!()
}

/// A compiled jq program.
pub struct JqFilter {
	source: String,
}

impl JqFilter {
	pub fn compile(source: &str) -> Result<Self, String> {
		todo!()
	}

	pub fn source(&self) -> &str {
		&self.source
	}

	/// Every output the program yields for `input`.
	pub fn run(&self, input: Json) -> Result<Vec<Json>, String> {
		todo!()
	}

	/// True when the program's first output is truthy (jq's `select` semantics).
	pub fn matches(&self, input: Json) -> Result<bool, String> {
		todo!()
	}
}
