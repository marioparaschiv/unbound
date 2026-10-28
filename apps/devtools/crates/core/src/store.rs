//! The element tree, as the backend's `operations` batches describe it.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::operations::OperationsBatch;

/// A backend-assigned element id. Ids are unique per connection and are reassigned when the
/// backend remounts its roots (after a component-filter change).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ElementId(pub i64);

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(transparent)]
pub struct RendererId(pub i64);

/// `ElementType*` from react-devtools-shared's `types.js`, as react-devtools-core 8 numbers them.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ElementKind {
	Class,
	Context,
	Function,
	ForwardRef,
	Host,
	Memo,
	Other,
	Profiler,
	Root,
	Suspense,
	SuspenseList,
	TracingMarker,
	Virtual,
	ViewTransition,
	Activity,
}

impl ElementKind {
	/// Maps the wire number; unknown numbers become [`ElementKind::Other`].
	pub fn from_wire(n: i64) -> Self {
		todo!("table from react-devtools-shared types.js")
	}

	/// Short label shown as a badge and accepted by queries (`"class"`, `"memo"`, `"host"`, ...).
	pub fn label(self) -> &'static str {
		todo!()
	}

	pub fn from_label(label: &str) -> Option<Self> {
		todo!()
	}
}

#[derive(Clone, Debug, Serialize)]
pub struct Element {
	pub id: ElementId,
	pub renderer: RendererId,
	pub parent: Option<ElementId>,
	pub owner: Option<ElementId>,
	pub kind: ElementKind,
	/// Display name with HOC wrappers stripped: `Connect(Memo(Foo))` is `Foo`.
	pub name: Arc<str>,
	/// The stripped wrappers, outermost first: `["Connect", "Memo"]`.
	pub hocs: Vec<Arc<str>>,
	pub key: Option<Arc<str>>,
	pub children: Vec<ElementId>,
	pub depth: u32,
	pub errors: u32,
	pub warnings: u32,
}

/// One visible line of the tree view.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Row {
	pub id: ElementId,
	pub depth: u32,
	pub has_children: bool,
	pub expanded: bool,
}

#[derive(Debug, thiserror::Error)]
pub enum StoreError {
	#[error("operations reference unknown element {0:?}")]
	UnknownElement(ElementId),
	#[error("element {0:?} added twice")]
	Duplicate(ElementId),
}

#[derive(Default)]
pub struct Store {
	elements: HashMap<ElementId, Element>,
	roots: Vec<ElementId>,
}

impl Store {
	/// Applies one decoded batch. On error the store keeps what applied before the bad op; the
	/// session then asks the backend to resend the tree.
	pub fn apply(&mut self, batch: &OperationsBatch) -> Result<(), StoreError> {
		todo!()
	}

	pub fn clear(&mut self) {
		todo!()
	}

	pub fn get(&self, id: ElementId) -> Option<&Element> {
		todo!()
	}

	pub fn roots(&self) -> &[ElementId] {
		&self.roots
	}

	pub fn len(&self) -> usize {
		self.elements.len()
	}

	pub fn is_empty(&self) -> bool {
		self.elements.is_empty()
	}

	/// Parent chain from `id`'s parent up to its root.
	pub fn ancestors(&self, id: ElementId) -> impl Iterator<Item = &Element> + '_ {
		std::iter::empty::<&Element>().chain(std::iter::once(todo!()))
	}

	/// Depth-first preorder from `from` (inclusive), or over every root when `None`.
	pub fn walk(&self, from: Option<ElementId>) -> impl Iterator<Item = &Element> + '_ {
		std::iter::empty::<&Element>().chain(std::iter::once(todo!()))
	}

	/// The visible rows for a tree view: preorder, skipping descendants of `collapsed` ids.
	pub fn rows(&self, collapsed: &HashSet<ElementId>) -> Vec<Row> {
		todo!()
	}
}

/// Splits `Connect(Memo(Foo))` into `("Foo", ["Connect", "Memo"])`, as the DevTools frontend does.
pub fn split_hocs(display_name: &str) -> (Arc<str>, Vec<Arc<str>>) {
	todo!()
}
