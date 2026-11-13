//! The motion when a folder or value opens or closes: its chevron turns, and the block of rows under
//! it grows or shrinks in height, pushing the rows below along. The list is uniform, so a fold shows
//! its block a row at a time, crops the last one shown and lifts every row after it by the rest.

use std::collections::HashSet;
use std::hash::Hash;
use std::ops::Range;
use std::time::{Duration, Instant};

use gpui::{Div, Pixels, Styled};

use crate::smooth_scroll::ease_out_expo;

/// How long a chevron takes to turn.
const TURN: Duration = Duration::from_millis(180);
/// How long a block takes to grow or shrink.
const FOLD: Duration = Duration::from_millis(280);
/// A block folds at most this many rows; the rest, past the bottom of the pane, come and go at once.
const FOLDED: usize = 32;

fn progress(at: Instant, length: Duration) -> f32 {
	ease_out_expo(at.elapsed().as_secs_f32() / length.as_secs_f32())
}

/// A chevron turning after its row opened or closed.
pub(super) struct Turn<K> {
	key: K,
	open: bool,
	at: Instant,
}

impl<K: PartialEq> Turn<K> {
	pub fn new(key: K, open: bool) -> Self {
		Self {
			key,
			open,
			at: Instant::now(),
		}
	}

	/// How far `key`'s chevron points down, from 0 (right) to 1 (down); it holds there once turned.
	pub fn of(&self, key: &K) -> Option<f32> {
		if self.key != *key {
			return None;
		}
		let turned = progress(self.at, TURN);
		Some(if self.open { turned } else { 1. - turned })
	}

	pub fn moving(&self) -> bool {
		self.at.elapsed() < TURN
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
	open: bool,
	at: Instant,
	/// How many rows of the block show, the last one in part. Sampled once a frame by `tick`, so
	/// the list's row count and each row's place agree.
	shown: f32,
}

impl Fold {
	/// The rows of `full` whose keys are not in `part`, as one block, or `None` when there are none.
	pub fn between<K: Eq + Hash>(
		part: impl IntoIterator<Item = Option<K>>,
		full: impl IntoIterator<Item = Option<K>>,
		open: bool,
	) -> Option<Self> {
		let part: HashSet<K> = part.into_iter().flatten().collect();
		let mut block: Option<Range<usize>> = None;
		for (ix, key) in full.into_iter().enumerate() {
			if key.is_some_and(|key| !part.contains(&key)) {
				let start = block.as_ref().map_or(ix, |block| block.start);
				block = Some(start..ix + 1);
			}
		}
		let mut fold = Self {
			block: block?,
			open,
			at: Instant::now(),
			shown: 0.,
		};
		fold.tick();
		Some(fold)
	}

	/// Samples how far the fold has gone, for the frame about to draw.
	pub fn tick(&mut self) {
		let rows = self.block.len().min(FOLDED) as f32;
		let grown = progress(self.at, FOLD);
		self.shown = rows * if self.open { grown } else { 1. - grown };
	}

	pub fn opening(&self) -> bool {
		self.open
	}

	pub fn done(&self) -> bool {
		self.at.elapsed() >= FOLD
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
		let fold = Fold::between(part, full, true).expect("new rows");
		assert_eq!(fold.block, 1..3);
		assert!(Fold::between(part, part, true).is_none());
	}

	#[test]
	fn a_folding_block_crops_its_last_row_and_lifts_the_rest() {
		let fold = Fold {
			block: 2..6,
			open: true,
			at: Instant::now(),
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
		let fold = Fold::between([Some(1)], [Some(1), Some(2), Some(3)], false).expect("a block");
		assert_eq!(fold.count(3), 3);
		let (row, place) = fold.place(2);
		assert_eq!(row, 2);
		assert!(place == Place::Whole || matches!(place, Place::Cropped(share) if share > 0.9));
		assert!(!fold.done());
	}

	#[test]
	fn a_turn_belongs_to_one_key() {
		let turn = Turn::new("a", true);
		assert!(turn.of(&"a").is_some_and(|turned| turned < 0.5));
		assert_eq!(turn.of(&"b"), None);
		assert!(
			Turn::new("a", false)
				.of(&"a")
				.is_some_and(|turned| turned > 0.5)
		);
	}
}
