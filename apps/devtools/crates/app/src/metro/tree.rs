//! A loaded module's exports as a tree. Each open value holds the pages of children the device sent;
//! nothing is fetched until a row opens, and a getter runs only when its row is clicked. A value whose
//! ref is already open above it is circular and does not open again.

use std::rc::Rc;

use gpui::SharedString;
use unbound_devtools_core::{ChildrenPage, MetroError, MetroValue};

/// One step from a value to a child: the nth property, or the nth slot such as `[[Prototype]]`.
/// Slots are indexed apart, so a later page of properties never shifts a slot's path.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Step {
	Property(usize),
	Slot(usize),
}

pub type Path = Rc<[Step]>;

/// A request for a value's children or a getter, while it runs or after it failed.
pub enum Fetch {
	Idle,
	Loading,
	Failed(MetroError),
}

pub struct Children {
	pub properties: Vec<Node>,
	pub slots: Vec<Node>,
	pub total: u32,
	/// The first page or the next one.
	pub fetch: Fetch,
}

pub struct Node {
	pub value: MetroValue,
	pub expanded: bool,
	pub children: Option<Children>,
	/// A getter being run, or what stopped it.
	pub read: Fetch,
}

impl Node {
	pub fn new(value: MetroValue) -> Self {
		Self {
			value,
			expanded: false,
			children: None,
			read: Fetch::Idle,
		}
	}

	/// Takes in a page of children: the first replaces what was there, a later one appends.
	pub fn add_page(&mut self, page: ChildrenPage, first: bool) {
		let children = self.children.get_or_insert_with(|| Children {
			properties: Vec::new(),
			slots: Vec::new(),
			total: 0,
			fetch: Fetch::Idle,
		});
		if first {
			children.properties.clear();
			children.slots = page.internal.into_iter().map(Node::new).collect();
		}
		children
			.properties
			.extend(page.children.into_iter().map(Node::new));
		children.total = page.total;
		children.fetch = Fetch::Idle;
	}

	pub fn get(&self, path: &[Step]) -> Option<&Node> {
		path.iter().try_fold(self, |node, step| {
			let children = node.children.as_ref()?;
			match *step {
				Step::Property(ix) => children.properties.get(ix),
				Step::Slot(ix) => children.slots.get(ix),
			}
		})
	}

	pub fn at(&mut self, path: &[Step]) -> Option<&mut Node> {
		let Some((step, rest)) = path.split_first() else {
			return Some(self);
		};
		let children = self.children.as_mut()?;
		let child = match *step {
			Step::Property(ix) => children.properties.get_mut(ix)?,
			Step::Slot(ix) => children.slots.get_mut(ix)?,
		};
		child.at(rest)
	}
}

/// One line of the tree on screen.
#[derive(Clone)]
pub enum Row {
	Value {
		path: Path,
		depth: u32,
		circular: bool,
	},
	/// Loads the next page of `path`'s properties.
	More { path: Path, depth: u32 },
	/// A page loading or failed under `path`.
	Note {
		path: Path,
		depth: u32,
		text: SharedString,
		error: bool,
	},
}

impl Row {
	/// The value's path, the key its row keeps while rows open and close around it.
	pub fn key(&self) -> Option<&Path> {
		match self {
			Self::Value { path, .. } => Some(path),
			Self::More { .. } | Self::Note { .. } => None,
		}
	}
}

/// The rows for `root` and every open value under it, in order.
pub fn rows(root: &Node) -> Vec<Row> {
	let mut rows = Vec::new();
	let mut ancestors = Vec::new();
	walk(root, Rc::from([]), 0, &mut ancestors, &mut rows);
	rows
}

fn walk<'a>(
	node: &'a Node,
	path: Path,
	depth: u32,
	ancestors: &mut Vec<&'a str>,
	rows: &mut Vec<Row>,
) {
	let own_ref = node.value.value_ref.as_deref();
	let circular = own_ref.is_some_and(|own| ancestors.contains(&own));
	rows.push(Row::Value {
		path: path.clone(),
		depth,
		circular,
	});
	if circular || !node.expanded || !node.value.expandable() {
		return;
	}
	let Some(children) = &node.children else {
		return;
	};
	let child_path = |step: Step| -> Path { path.iter().copied().chain([step]).collect() };
	ancestors.extend(own_ref);
	for (ix, child) in children.properties.iter().enumerate() {
		walk(
			child,
			child_path(Step::Property(ix)),
			depth + 1,
			ancestors,
			rows,
		);
	}
	let listed = children.properties.len() as u32;
	match &children.fetch {
		Fetch::Loading => rows.push(Row::Note {
			path: path.clone(),
			depth: depth + 1,
			text: "Loading…".into(),
			error: false,
		}),
		Fetch::Failed(error) => rows.push(Row::Note {
			path: path.clone(),
			depth: depth + 1,
			text: error.to_string().into(),
			error: true,
		}),
		Fetch::Idle if listed < children.total => rows.push(Row::More {
			path: path.clone(),
			depth: depth + 1,
		}),
		Fetch::Idle => {}
	}
	for (ix, child) in children.slots.iter().enumerate() {
		walk(
			child,
			child_path(Step::Slot(ix)),
			depth + 1,
			ancestors,
			rows,
		);
	}
	ancestors.truncate(ancestors.len() - usize::from(own_ref.is_some()));
}

#[cfg(test)]
mod tests {
	use unbound_devtools_core::MetroValueKind;

	use super::*;

	fn value(key: &str, value_ref: Option<&str>) -> MetroValue {
		MetroValue {
			key: key.into(),
			kind: MetroValueKind::Object,
			text: "Object {…}".into(),
			value_ref: value_ref.map(str::to_owned),
			internal: false,
		}
	}

	fn page(children: Vec<MetroValue>, total: u32) -> ChildrenPage {
		ChildrenPage {
			value: value("", None),
			children,
			total,
			internal: vec![value("[[Prototype]]", Some("e:9"))],
		}
	}

	#[test]
	fn a_value_open_above_itself_is_circular() {
		let mut root = Node::new(value("module.exports", Some("e:1")));
		root.expanded = true;
		root.add_page(page(vec![value("self", Some("e:1"))], 1), true);
		let rows = rows(&root);
		assert!(matches!(
			rows[1],
			Row::Value {
				circular: true,
				depth: 1,
				..
			}
		));
	}

	#[test]
	fn a_partial_page_ends_with_more_before_the_slots() {
		let mut root = Node::new(value("module.exports", Some("e:1")));
		root.expanded = true;
		root.add_page(page(vec![value("a", None)], 2), true);
		let rows = rows(&root);
		assert!(matches!(rows[2], Row::More { .. }));
		assert!(matches!(
			rows[3],
			Row::Value {
				circular: false,
				..
			}
		));

		root.add_page(page(vec![value("b", None)], 2), false);
		let child = root.at(&[Step::Property(1)]).expect("the second property");
		assert_eq!(child.value.key, "b");
		assert_eq!(
			root.at(&[Step::Slot(0)]).map(|slot| slot.value.key.clone()),
			Some("[[Prototype]]".into())
		);
	}
}
