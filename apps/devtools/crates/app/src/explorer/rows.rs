//! The explorer page flattened into list items: the host's cards, a notice, the description, then
//! each class of the chain with its open sections and their members. Only the changed run of items
//! is spliced into the list, so loading a section keeps the scroll position.

use std::rc::Rc;

use unbound_devtools_core::{ExplorerMember, ExplorerMemberKind};

use super::{Explorer, Load};

#[derive(Clone, Debug, PartialEq)]
pub(super) enum Item {
	/// The host's cards, on the first page of the history.
	Prelude,
	/// Why the page shows its class instead, or that the object is loading or failed.
	Notice,
	Description,
	/// A class of the chain, by index.
	Class {
		index: usize,
	},
	Section {
		class: String,
		kind: ExplorerMemberKind,
	},
	Member {
		class: String,
		kind: ExplorerMemberKind,
		index: usize,
	},
	/// A section that is loading, failed, or has nothing that matches.
	Note {
		class: String,
		kind: ExplorerMemberKind,
	},
	/// The rest of a section past its listed members.
	More {
		class: String,
		kind: ExplorerMemberKind,
	},
}

impl Item {
	/// Whether the item's height follows its content, so it is measured again on every rebuild.
	fn is_variable(&self) -> bool {
		matches!(self, Item::Prelude | Item::Notice | Item::Description)
	}
}

impl Explorer {
	pub(super) fn member(
		&self,
		class: &str,
		kind: ExplorerMemberKind,
		index: usize,
	) -> Option<&Rc<ExplorerMember>> {
		match self.section(class, kind)? {
			Load::Loaded(section) => section.members.get(index),
			_ => None,
		}
	}

	/// The kinds a class's group lists: those it declares any of, in the platform's order.
	pub(super) fn kinds_of(&self, index: usize) -> Vec<ExplorerMemberKind> {
		let Some(object) = self.object() else {
			return Vec::new();
		};
		let Some(class) = object.chain.get(index) else {
			return Vec::new();
		};
		object
			.platform
			.kinds()
			.iter()
			.copied()
			.filter(|kind| class.counts.get(kind).is_some_and(|count| *count > 0))
			.collect()
	}

	fn items(&self) -> Vec<Item> {
		let mut items = Vec::new();
		if !self.is_open() {
			return items;
		}
		if self.history.at_start() {
			items.push(Item::Prelude);
		}
		let object = match &self.object {
			None => return items,
			Some(Load::Loading | Load::Failed(_)) => {
				items.push(Item::Notice);
				return items;
			}
			Some(Load::Loaded(object)) => object.clone(),
		};
		if self.fell_back {
			items.push(Item::Notice);
		}
		if object.description.is_some() {
			items.push(Item::Description);
		}
		for (index, class) in object.chain.iter().enumerate() {
			items.push(Item::Class { index });
			if !self.expanded.contains(&class.name) {
				continue;
			}
			for kind in self.kinds_of(index) {
				let name = class.name.clone();
				items.push(Item::Section {
					class: name.clone(),
					kind,
				});
				if self.open.contains(&(name.clone(), kind)) {
					self.push_section(name, kind, &mut items);
				}
			}
		}
		items
	}

	fn push_section(&self, class: String, kind: ExplorerMemberKind, items: &mut Vec<Item>) {
		let Some(Load::Loaded(section)) = self.section(&class, kind) else {
			items.push(Item::Note { class, kind });
			return;
		};
		if section.members.is_empty() {
			items.push(Item::Note { class, kind });
			return;
		}
		items.extend((0..section.members.len()).map(|index| Item::Member {
			class: class.clone(),
			kind,
			index,
		}));
		let remaining = section.total as usize > section.members.len();
		if remaining || section.next.is_some() {
			items.push(Item::More { class, kind });
		}
	}

	/// Rebuilds the items and splices the changed run into the list.
	pub(super) fn rebuild(&mut self) {
		let items = self.items();
		let old = &self.items;
		let prefix = old.iter().zip(&items).take_while(|(a, b)| a == b).count();
		let suffix = old[prefix..]
			.iter()
			.rev()
			.zip(items[prefix..].iter().rev())
			.take_while(|(a, b)| a == b)
			.count();
		self.list
			.splice(prefix..old.len() - suffix, items.len() - prefix - suffix);
		for (ix, item) in items.iter().enumerate() {
			if item.is_variable() {
				self.list.remeasure_items(ix..ix + 1);
			}
		}
		self.items = Rc::new(items);
		self.restore_scroll();
	}

	/// Scrolls a page shown again to where it was left, once its open sections are listed.
	fn restore_scroll(&mut self) {
		let Some(offset) = self.restore_scroll else {
			return;
		};
		let listing = match &self.object {
			Some(Load::Loaded(_)) => self.open.iter().any(|(class, kind)| {
				matches!(self.section(class, *kind), None | Some(Load::Loading))
			}),
			Some(Load::Loading) => true,
			_ => false,
		};
		if !listing {
			self.restore_scroll = None;
			self.list.scroll_to(offset);
		}
	}
}
