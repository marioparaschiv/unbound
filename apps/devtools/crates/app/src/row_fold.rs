//! A tree list's open and close motion, keyed by the row toggled: its chevron turns and the rows under
//! it fold in or out (see [`crate::unfold`]). The list rebuilds its rows from its own state; while a
//! close runs it keeps the closing row's subtree listed ([`RowFold::held_open`]) until the fold ends.

use std::ops::Range;

use crate::unfold::{Fold, Place, Turn};

/// The rows after `anchor` that sit deeper than it: its subtree in a flattened tree.
pub fn subtree(anchor: usize, len: usize, depth: impl Fn(usize) -> u32) -> Range<usize> {
	let level = depth(anchor);
	let end = (anchor + 1..len)
		.find(|&ix| depth(ix) <= level)
		.unwrap_or(len);
	anchor + 1..end
}

/// The last row toggled: its chevron's turn, and its subtree's fold while that runs.
pub struct RowFold<K> {
	turn: Option<Turn<K>>,
	fold: Option<(K, Fold)>,
}

impl<K> Default for RowFold<K> {
	fn default() -> Self {
		Self {
			turn: None,
			fold: None,
		}
	}
}

impl<K: Clone + PartialEq> RowFold<K> {
	/// Starts `key` opening or closing, from where it is when it was already moving. The caller
	/// rebuilds its rows next and calls [`Self::anchor`].
	pub fn toggle(&mut self, key: K, open: bool, reduce_motion: bool) {
		if reduce_motion {
			self.clear();
			return;
		}
		self.turn = Some(Turn::new(key.clone(), open, self.turn.as_ref()));
		let previous = self
			.fold
			.take()
			.filter(|(folding, _)| *folding == key)
			.map(|(_, fold)| fold);
		self.fold = Some((key, Fold::over(0..0, open, previous.as_ref())));
	}

	/// Folds `key`'s rows in again, as when its children arrive after it opened.
	pub fn reopen(&mut self, key: K, reduce_motion: bool) {
		let running = self
			.fold
			.as_ref()
			.is_some_and(|(folding, fold)| *folding == key && fold.opening());
		if !running && !reduce_motion {
			self.fold = Some((key, Fold::over(0..0, true, None)));
		}
	}

	/// The row whose subtree a close still lists.
	pub fn held_open(&self) -> Option<&K> {
		self.fold
			.as_ref()
			.filter(|(_, fold)| !fold.opening())
			.map(|(key, _)| key)
	}

	/// Points the fold at its row's subtree in the rebuilt rows; `find` gives that subtree, or `None`
	/// when the row is gone. An empty subtree ends the fold.
	pub fn anchor(&mut self, find: impl FnOnce(&K) -> Option<Range<usize>>) {
		let Some((key, fold)) = &mut self.fold else {
			return;
		};
		match find(key) {
			Some(block) if !block.is_empty() => fold.rebase(block),
			_ => self.fold = None,
		}
	}

	/// Moves the fold on a frame. True when a close ended, so the caller drops its rows.
	pub fn tick(&mut self) -> bool {
		match &mut self.fold {
			Some((_, fold)) if fold.done() => {
				let closed = !fold.opening();
				self.fold = None;
				closed
			}
			Some((_, fold)) => {
				fold.tick();
				false
			}
			None => false,
		}
	}

	pub fn moving(&self) -> bool {
		self.turn.as_ref().is_some_and(Turn::moving) || self.fold.is_some()
	}

	pub fn clear(&mut self) {
		self.turn = None;
		self.fold = None;
	}

	/// How many of the list's `total` rows are on screen now.
	pub fn count(&self, total: usize) -> usize {
		self.fold
			.as_ref()
			.map_or(total, |(_, fold)| fold.count(total))
	}

	/// The row shown at `ix` on screen, and how it sits.
	pub fn place(&self, ix: usize) -> (usize, Place) {
		self.fold
			.as_ref()
			.map_or((ix, Place::Whole), |(_, fold)| fold.place(ix))
	}

	/// How far `key`'s chevron points down, from 0 (right) to 1 (down).
	pub fn turn(&self, key: &K, open: bool) -> f32 {
		self.turn
			.as_ref()
			.and_then(|turn| turn.of(key))
			.unwrap_or(if open { 1. } else { 0. })
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_subtree_ends_at_the_next_row_as_shallow() {
		let depths = [0, 1, 2, 1, 0, 1];
		assert_eq!(subtree(1, depths.len(), |ix| depths[ix]), 2..3);
		assert_eq!(subtree(0, depths.len(), |ix| depths[ix]), 1..4);
		assert_eq!(subtree(4, depths.len(), |ix| depths[ix]), 5..6);
		assert!(subtree(2, depths.len(), |ix| depths[ix]).is_empty());
	}

	#[test]
	fn a_close_holds_its_rows_until_it_ends() {
		let mut fold = RowFold::default();
		fold.toggle("a", false, false);
		assert_eq!(fold.held_open(), Some(&"a"));
		fold.anchor(|_| Some(1..4));
		assert_eq!(fold.count(6), 6);
		fold.toggle("a", true, false);
		assert_eq!(fold.held_open(), None);
		fold.anchor(|_| None);
		assert!(!fold.tick());
		assert_eq!(fold.count(6), 6);
	}

	#[test]
	fn reduced_motion_folds_nothing() {
		let mut fold = RowFold::default();
		fold.toggle("a", true, true);
		assert!(!fold.moving());
		assert_eq!(fold.turn(&"a", true), 1.);
	}
}
