//! The explorer's open and close motion: the items under a class or section grow in or shrink away
//! together, each cropped to the same share of its own height, while the chevron turns. A close keeps
//! its items listed until it ends.

use std::ops::Range;

use gpui::{AnyElement, IntoElement};
use unbound_devtools_core::ExplorerMemberKind;

use super::rows::Item;
use super::{Explorer, Load};
use crate::accordion::{Measured, crop};
use crate::row_fold::subtree;
use crate::transition::Transition;
use crate::unfold::FOLD;

/// What opened or closed: a class's group, or one of its sections.
#[derive(Clone, Debug, PartialEq)]
pub(super) enum FoldKey {
	Class(String),
	Section(String, ExplorerMemberKind),
}

/// How deep an item sits: a class, its sections, then their members and notes.
fn level(item: &Item) -> u32 {
	match item {
		Item::Prelude | Item::Notice | Item::Description | Item::Class { .. } => 0,
		Item::Section { .. } => 1,
		Item::Member { .. } | Item::Note { .. } | Item::More { .. } => 2,
	}
}

pub(super) struct ItemFold {
	pub key: FoldKey,
	transition: Transition,
	block: Range<usize>,
	/// Each block item's height as last laid out, by its place in the block.
	heights: Vec<Measured>,
}

impl ItemFold {
	pub fn new(key: FoldKey, open: bool, previous: Option<Self>) -> Self {
		let mut transition = previous
			.filter(|fold| fold.key == key)
			.map_or_else(|| Transition::toward(open), |fold| fold.transition);
		transition.set(open, FOLD);
		Self {
			key,
			transition,
			block: 0..0,
			heights: Vec::new(),
		}
	}

	pub fn opening(&self) -> bool {
		self.transition.is_open()
	}

	pub fn done(&self) -> bool {
		!self.transition.is_moving(FOLD)
	}

	pub fn turn(&self, key: &FoldKey) -> Option<f32> {
		(self.key == *key).then(|| self.transition.value(FOLD))
	}
}

impl Explorer {
	/// Starts `key` opening or closing; the caller rebuilds the items next.
	pub(super) fn fold(&mut self, key: FoldKey, open: bool, reduce_motion: bool) {
		self.item_fold = (!reduce_motion).then(|| ItemFold::new(key, open, self.item_fold.take()));
	}

	/// Whether `key`'s items are listed while a close runs.
	pub(super) fn held_open(&self, key: &FoldKey) -> bool {
		self.item_fold
			.as_ref()
			.is_some_and(|fold| !fold.opening() && fold.key == *key)
	}

	/// How far `key`'s chevron points down, from 0 (right) to 1 (down).
	pub(super) fn turn(&self, key: &FoldKey, open: bool) -> f32 {
		self.item_fold
			.as_ref()
			.and_then(|fold| fold.turn(key))
			.unwrap_or(if open { 1. } else { 0. })
	}

	/// Points the fold at its items after a rebuild, or ends it when none are left.
	pub(super) fn anchor_fold(&mut self) {
		let Some(fold) = &mut self.item_fold else {
			return;
		};
		let items = &self.items;
		let chain = match &self.object {
			Some(Load::Loaded(object)) => object.chain.as_slice(),
			_ => &[],
		};
		let anchor = items.iter().position(|item| match (&fold.key, item) {
			(FoldKey::Class(name), Item::Class { index }) => {
				chain.get(*index).is_some_and(|class| class.name == *name)
			}
			(FoldKey::Section(name, kind), Item::Section { class, kind: at }) => {
				class == name && kind == at
			}
			_ => false,
		});
		let block = anchor.map(|anchor| subtree(anchor, items.len(), |ix| level(&items[ix])));
		match block {
			Some(block) if !block.is_empty() => {
				fold.heights.resize_with(block.len(), Measured::default);
				fold.block = block;
			}
			_ => self.item_fold = None,
		}
	}

	/// Moves the fold on a frame: ends it when done, dropping a close's items. True while it runs.
	pub fn tick_fold(&mut self) -> bool {
		let Some(fold) = &self.item_fold else {
			return false;
		};
		if fold.done() {
			let closed = !fold.opening();
			self.item_fold = None;
			if closed {
				self.rebuild();
			}
			return false;
		}
		self.list.remeasure_items(fold.block.clone());
		true
	}

	/// `item` at `ix`, cropped while its block folds.
	pub(super) fn fold_item(&self, ix: usize, item: impl IntoElement) -> AnyElement {
		match &self.item_fold {
			Some(fold) if fold.block.contains(&ix) => crop(
				item,
				fold.transition.value(FOLD),
				fold.opening(),
				&fold.heights[ix - fold.block.start],
			),
			_ => item.into_any_element(),
		}
	}
}
