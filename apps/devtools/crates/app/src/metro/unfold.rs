//! The motion when a folder or value opens or closes: its chevron turns, and the block of rows under
//! it grows or shrinks in height, pushing the rows below along. The list is uniform, so a fold shows
//! its block a row at a time, crops the last one shown and lifts every row after it by the rest.
//! Toggling a row again mid-way turns its chevron and block back from where they are.

use std::collections::HashSet;
use std::hash::Hash;
use std::ops::Range;
use std::time::Duration;

use gpui::{Div, Pixels, Styled};

use crate::smooth_scroll::ease_out_expo;
use crate::transition::{Timing, Transition};

/// How long a chevron takes to turn.
const TURN: Timing = Timing {
	open: Duration::from_millis(180),
	close: Duration::from_millis(180),
	ease: ease_out_expo,
};
/// How long a block takes to grow or shrink.
const FOLD: Timing = Timing {
	open: Duration::from_millis(280),
	close: Duration::from_millis(280),
	ease: ease_out_expo,
};
/// A block folds at most this many rows; the rest, past the bottom of the pane, come and go at once.
const FOLDED: usize = 32;

/// A chevron turning after its row opened or closed.
pub(super) struct Turn<K> {
	key: K,
	motion: Transition,
}

impl<K: PartialEq> Turn<K> {
	/// Turns `key`'s chevron; when `previous` was turning the same one, from where it is.
	pub fn new(key: K, open: bool, previous: Option<&Self>) -> Self {
		let mut motion = previous
			.filter(|turn| turn.key == key)
			.map_or_else(|| Transition::toward(open), |turn| turn.motion);
		motion.set(open, TURN);
		Self { key, motion }
	}

	/// How far `key`'s chevron points down, from 0 (right) to 1 (down); it holds there once turned.
	pub fn of(&self, key: &K) -> Option<f32> {
		(self.key == *key).then(|| self.motion.value(TURN))
	}

	pub fn moving(&self) -> bool {
		self.motion.is_moving(TURN)
	}
}

/// How a row on screen sits while its list folds.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum Place {
	Whole,
	/// The last row of the block shown, cropped to this share of its height.
	Cropped(f32),
	/// A row after the block, lifted by this share of a row.
	Lifted(f32),
}

impl Place {
	/// `row`, a list item `height` tall, cropped or lifted to where the fold has it.
	pub fn fit(self, row: Div, height: Pixels) -> Div {
		match self {
			Self::Whole => row,
			Self::Cropped(share) => row.h(height * share).overflow_hidden(),
			Self::Lifted(share) => row.relative().top(-(height * share)),
		}
	}
}

/// A block of rows growing in after its row opened, or shrinking away after it closed. The list
/// holds every row of the block until the fold ends.
pub(super) struct Fold {
	block: Range<usize>,
	motion: Transition,
	/// How many rows of the block show, the last one in part. Sampled once a frame by `tick`, so
	/// the list's row count and each row's place agree.
	shown: f32,
}

/// @description The fold from rows keyed `old` to rows keyed `new`, turning a running fold of the same block back.
/// @param previous The fold in flight, if any.
/// @returns The fold, and whether the list takes `new` now; a close keeps `old` until its fold ends.
pub(super) fn refold<K: Eq + Hash>(
	old: &[Option<K>],
	new: &[Option<K>],
	previous: Option<Fold>,
) -> (Option<Fold>, bool) {
	let previous = previous.filter(|fold| !fold.done());
	if let Some(fold) = Fold::between(old, new, true, previous.as_ref()) {
		return (Some(fold), true);
	}
	if let Some(fold) = Fold::between(new, old, false, previous.as_ref()) {
		return (Some(fold), false);
	}
	// Reopened while closing: the list still holds the block, so it grows back in place.
	match previous {
		Some(mut fold) if old == new && !fold.opening() => {
			fold.motion.set(true, FOLD);
			fold.tick();
			(Some(fold), true)
		}
		_ => (None, true),
	}
}

impl Fold {
	/// The rows of `full` whose keys are not in `part`, as one block, or `None` when there are none.
	/// When `previous` folded the same block, this one starts from where that one is.
	fn between<K: Eq + Hash>(
		part: &[Option<K>],
		full: &[Option<K>],
		open: bool,
		previous: Option<&Self>,
	) -> Option<Self> {
		let part: HashSet<&K> = part.iter().flatten().collect();
		let mut block: Option<Range<usize>> = None;
		for (ix, key) in full.iter().enumerate() {
			if key.as_ref().is_some_and(|key| !part.contains(key)) {
				let start = block.as_ref().map_or(ix, |block| block.start);
				block = Some(start..ix + 1);
			}
		}
		let block = block?;
		let mut motion = previous
			.filter(|fold| fold.block == block)
			.map_or_else(|| Transition::toward(open), |fold| fold.motion);
		motion.set(open, FOLD);
		let mut fold = Self {
			block,
			motion,
			shown: 0.,
		};
		fold.tick();
		Some(fold)
	}

	/// Samples how far the fold has gone, for the frame about to draw.
	pub fn tick(&mut self) {
		let rows = self.block.len().min(FOLDED) as f32;
		self.shown = rows * self.motion.value(FOLD);
	}

	pub fn opening(&self) -> bool {
		self.motion.is_open()
	}

	pub fn done(&self) -> bool {
		!self.motion.is_moving(FOLD)
	}

	/// How many rows of the block are hidden now.
	fn hidden(&self) -> usize {
		self.block.len() - self.shown.ceil() as usize
	}

	/// How many of the list's `total` rows are on screen now.
	pub fn count(&self, total: usize) -> usize {
		total - self.hidden()
	}

	/// The list row shown at `ix` on screen, and how it sits.
	pub fn place(&self, ix: usize) -> (usize, Place) {
		let shown = self.shown;
		let whole = shown.ceil();
		let cut = self.block.start + whole as usize;
		let gap = whole - shown;
		if ix >= cut {
			let place = if gap > 0. {
				Place::Lifted(gap)
			} else {
				Place::Whole
			};
			(ix + self.hidden(), place)
		} else if ix + 1 == cut && gap > 0. {
			(ix, Place::Cropped(1. - gap))
		} else {
			(ix, Place::Whole)
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_fold_spans_the_new_rows() {
		let part = [Some("a"), Some("b"), None];
		let full = [Some("a"), Some("a/x"), Some("a/y"), Some("b"), None];
		let fold = Fold::between(&part, &full, true, None).expect("new rows");
		assert_eq!(fold.block, 1..3);
		assert!(Fold::between(&part, &part, true, None).is_none());
	}

	#[test]
	fn a_folding_block_crops_its_last_row_and_lifts_the_rest() {
		let fold = Fold {
			block: 2..6,
			motion: Transition::opening(),
			shown: 2.25,
		};
		assert_eq!(fold.count(10), 9);
		assert_eq!(fold.place(1), (1, Place::Whole));
		assert_eq!(fold.place(3), (3, Place::Whole));
		assert_eq!(fold.place(4), (4, Place::Cropped(0.25)));
		assert_eq!(fold.place(5), (6, Place::Lifted(0.75)));
		assert_eq!(fold.place(8), (9, Place::Lifted(0.75)));
	}

	#[test]
	fn a_closing_fold_starts_whole() {
		let fold =
			Fold::between(&[Some(1)], &[Some(1), Some(2), Some(3)], false, None).expect("a block");
		assert_eq!(fold.count(3), 3);
		let (row, place) = fold.place(2);
		assert_eq!(row, 2);
		assert!(place == Place::Whole || matches!(place, Place::Cropped(share) if share > 0.9));
		assert!(!fold.done());
	}

	#[test]
	fn a_reversed_fold_turns_back_from_where_it_is() {
		let (short, full) = ([Some(1)], [Some(1), Some(2), Some(3)]);
		let (opening, _) = refold(&short, &full, None);
		let opening = opening.expect("an open");
		let shown = opening.shown;
		let (closing, take) = refold(&full, &short, Some(opening));
		let closing = closing.expect("a close");
		assert!(!take && !closing.opening());
		assert!((closing.shown - shown).abs() < 0.2);
		let (reopened, take) = refold(&full, &full, Some(closing));
		assert!(take && reopened.is_some_and(|fold| fold.opening()));
	}

	#[test]
	fn a_turn_belongs_to_one_key() {
		let turn = Turn::new("a", true, None);
		assert!(turn.of(&"a").is_some_and(|turned| turned < 0.5));
		assert_eq!(turn.of(&"b"), None);
		assert!(
			Turn::new("a", false, None)
				.of(&"a")
				.is_some_and(|turned| turned > 0.5)
		);
		let reversed = Turn::new("a", false, Some(&turn));
		assert!(reversed.of(&"a").is_some_and(|turned| turned < 0.5));
	}
}
