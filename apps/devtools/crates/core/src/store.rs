//! The element tree, as the backend's `operations` batches describe it.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use serde::{Deserialize, Serialize};

use crate::operations::{OperationsBatch, TreeOp};

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

/// Wire number and label per kind. `Other` is 9, the backend's `ElementTypeOtherOrUnknown`.
const KINDS: [(ElementKind, i64, &str); 15] = [
	(ElementKind::Class, 1, "class"),
	(ElementKind::Context, 2, "context"),
	(ElementKind::Function, 5, "function"),
	(ElementKind::ForwardRef, 6, "forward_ref"),
	(ElementKind::Host, 7, "host"),
	(ElementKind::Memo, 8, "memo"),
	(ElementKind::Other, 9, "other"),
	(ElementKind::Profiler, 10, "profiler"),
	(ElementKind::Root, 11, "root"),
	(ElementKind::Suspense, 12, "suspense"),
	(ElementKind::SuspenseList, 13, "suspense_list"),
	(ElementKind::TracingMarker, 14, "tracing_marker"),
	(ElementKind::Virtual, 15, "virtual"),
	(ElementKind::ViewTransition, 16, "view_transition"),
	(ElementKind::Activity, 17, "activity"),
];

impl ElementKind {
	/// Maps the wire number; unknown numbers become [`ElementKind::Other`].
	pub fn from_wire(n: i64) -> Self {
		KINDS
			.iter()
			.find(|(_, wire, _)| *wire == n)
			.map_or(Self::Other, |(kind, _, _)| *kind)
	}

	/// The wire number, as component filters send it.
	pub fn wire(self) -> i64 {
		KINDS
			.iter()
			.find(|(kind, _, _)| *kind == self)
			.map_or(9, |(_, wire, _)| *wire)
	}

	/// Short label shown as a badge and accepted by queries (`"class"`, `"memo"`, `"host"`, ...).
	pub fn label(self) -> &'static str {
		KINDS
			.iter()
			.find(|(kind, _, _)| *kind == self)
			.map_or("other", |(_, _, label)| label)
	}

	/// Accepts labels case-insensitively, with or without `_`/`-` (`forwardRef`, `forward-ref`).
	pub fn from_label(label: &str) -> Option<Self> {
		let normalize = |s: &str| s.replace(['_', '-'], "").to_ascii_lowercase();
		let wanted = normalize(label);

		KINDS
			.iter()
			.find(|(_, _, l)| normalize(l) == wanted)
			.map(|(kind, _, _)| *kind)
	}

	/// Kinds whose display names carry HOC wrappers (`Memo(Foo)`), per the frontend's
	/// `parseElementDisplayNameFromBackend`.
	fn has_hoc_names(self) -> bool {
		matches!(
			self,
			Self::Class | Self::ForwardRef | Self::Function | Self::Memo | Self::Virtual
		)
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
	/// Roots and their direct children are both depth 0: roots are not drawn as rows.
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
		for op in &batch.ops {
			match op {
				TreeOp::AddRoot { id, .. } => {
					self.insert(Element {
						id: *id,
						renderer: batch.renderer,
						parent: None,
						owner: None,
						kind: ElementKind::Root,
						name: Arc::from("Root"),
						hocs: Vec::new(),
						key: None,
						children: Vec::new(),
						depth: 0,
						errors: 0,
						warnings: 0,
					})?;
					self.roots.push(*id);
				}
				TreeOp::Add {
					id,
					kind,
					parent,
					owner,
					display_name,
					key,
				} => {
					let parent_element = self
						.elements
						.get(parent)
						.ok_or(StoreError::UnknownElement(*parent))?;
					let depth = match parent_element.kind {
						ElementKind::Root => 0,
						_ => parent_element.depth + 1,
					};
					let (name, hocs) = match (display_name, kind.has_hoc_names()) {
						(Some(display_name), true) => split_hocs(display_name),
						(Some(display_name), false) => (display_name.clone(), Vec::new()),
						(None, _) => (Arc::from("Anonymous"), Vec::new()),
					};

					self.insert(Element {
						id: *id,
						renderer: batch.renderer,
						parent: Some(*parent),
						owner: *owner,
						kind: *kind,
						name,
						hocs,
						key: key.clone(),
						children: Vec::new(),
						depth,
						errors: 0,
						warnings: 0,
					})?;

					if let Some(parent) = self.elements.get_mut(parent) {
						parent.children.push(*id);
					}
				}
				TreeOp::Remove(ids) => {
					for id in ids {
						self.remove_subtree(*id);
					}
				}
				TreeOp::RemoveRoot => self.remove_subtree(batch.root),
				TreeOp::Reorder { id, children } => {
					let element = self
						.elements
						.get_mut(id)
						.ok_or(StoreError::UnknownElement(*id))?;
					element.children.clone_from(children);
				}
				TreeOp::ErrorsAndWarnings {
					id,
					errors,
					warnings,
				} => {
					// Counts can arrive for an element a later op in the same flush removes.
					if let Some(element) = self.elements.get_mut(id) {
						element.errors = *errors;
						element.warnings = *warnings;
					}
				}
				TreeOp::Ignored(_) => {}
			}
		}

		Ok(())
	}

	pub fn clear(&mut self) {
		self.elements.clear();
		self.roots.clear();
	}

	pub fn get(&self, id: ElementId) -> Option<&Element> {
		self.elements.get(&id)
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
		let first = self
			.get(id)
			.and_then(|element| element.parent)
			.and_then(|p| self.get(p));

		std::iter::successors(first, |element| element.parent.and_then(|p| self.get(p)))
	}

	/// Depth-first preorder from `from` (inclusive), or over every root when `None`.
	pub fn walk(&self, from: Option<ElementId>) -> impl Iterator<Item = &Element> + '_ {
		let mut stack: Vec<ElementId> = match from {
			Some(id) => vec![id],
			None => self.roots.iter().rev().copied().collect(),
		};

		std::iter::from_fn(move || {
			loop {
				let id = stack.pop()?;

				if let Some(element) = self.get(id) {
					stack.extend(element.children.iter().rev());
					return Some(element);
				}
			}
		})
	}

	/// The visible rows for a tree view: preorder, skipping descendants of `collapsed` ids.
	/// Roots are not rows; their children start at depth 0.
	pub fn rows(&self, collapsed: &HashSet<ElementId>) -> Vec<Row> {
		let mut rows = Vec::new();
		let mut stack: Vec<ElementId> = self.roots.iter().rev().copied().collect();

		while let Some(id) = stack.pop() {
			let Some(element) = self.get(id) else {
				continue;
			};

			if element.kind == ElementKind::Root {
				stack.extend(element.children.iter().rev());
				continue;
			}

			let expanded = !collapsed.contains(&id);

			rows.push(Row {
				id,
				depth: element.depth,
				has_children: !element.children.is_empty(),
				expanded,
			});

			if expanded {
				stack.extend(element.children.iter().rev());
			}
		}

		rows
	}

	fn insert(&mut self, element: Element) -> Result<(), StoreError> {
		if self.elements.contains_key(&element.id) {
			return Err(StoreError::Duplicate(element.id));
		}

		self.elements.insert(element.id, element);
		Ok(())
	}

	/// The backend removes children before parents, but a subtree removed whole stays consistent
	/// too. Unknown ids are skipped: after a store reset the backend still removes what it sent.
	fn remove_subtree(&mut self, id: ElementId) {
		let Some(element) = self.elements.remove(&id) else {
			return;
		};

		match element
			.parent
			.and_then(|parent| self.elements.get_mut(&parent))
		{
			Some(parent) => parent.children.retain(|child| *child != id),
			None => self.roots.retain(|root| *root != id),
		}

		let mut stack = element.children;

		while let Some(child) = stack.pop() {
			if let Some(removed) = self.elements.remove(&child) {
				stack.extend(removed.children);
			}
		}
	}
}

/// Splits `Connect(Memo(Foo))` into `("Foo", ["Connect", "Memo"])`, as the DevTools frontend does.
/// A React Compiler `Forget(...)` wrapper is dropped.
pub fn split_hocs(display_name: &str) -> (Arc<str>, Vec<Arc<str>>) {
	let display_name = display_name
		.strip_prefix("Forget(")
		.and_then(|inner| inner.strip_suffix(')'))
		.unwrap_or(display_name);

	if !display_name.contains('(') {
		return (Arc::from(display_name), Vec::new());
	}

	let mut parts: Vec<Arc<str>> = display_name
		.split(['(', ')'])
		.filter(|part| !part.is_empty())
		.map(Arc::from)
		.collect();

	match parts.pop() {
		Some(name) => (name, parts),
		None => (Arc::from(display_name), Vec::new()),
	}
}
