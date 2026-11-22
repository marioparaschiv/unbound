//! Blocks that open and close by growing or shrinking in height, for content that is not a uniform
//! list: inspector cards, nested values, console results. A block measures its content as it lays
//! out and draws that height times how far it has opened, on [`crate::unfold`]'s curve.

use std::cell::Cell;
use std::collections::HashMap;
use std::hash::Hash;
use std::rc::Rc;

use gpui::{AnyElement, Pixels, div, prelude::*, px};

use crate::transition::Transition;
use crate::unfold::FOLD;

/// One key's open or close in flight, and its content's height as last laid out.
struct Motion {
	transition: Transition,
	height: Measured,
}

/// The opens and closes running, by key. A settled key keeps no state: it is open or closed as its
/// owner says.
pub struct Accordion<K> {
	moving: HashMap<K, Motion>,
}

impl<K> Default for Accordion<K> {
	fn default() -> Self {
		Self {
			moving: HashMap::new(),
		}
	}
}

impl<K: Eq + Hash + Clone> Accordion<K> {
	/// Starts `key` opening or closing, from where it is when it was already moving.
	pub fn toggle(&mut self, key: K, open: bool, reduce_motion: bool) {
		if reduce_motion {
			self.moving.remove(&key);
			return;
		}
		let motion = self.moving.entry(key).or_insert_with(|| Motion {
			transition: Transition::toward(open),
			height: Rc::default(),
		});
		motion.transition.set(open, FOLD);
	}

	/// Whether `key`'s content is drawn: it is open, or still closing.
	pub fn shows(&self, key: &K, open: bool) -> bool {
		open || self.moving.contains_key(key)
	}

	/// How far `key` has opened, from 0 to 1; its chevron turns by the same amount.
	pub fn progress(&self, key: &K, open: bool) -> f32 {
		self.moving
			.get(key)
			.map_or(if open { 1. } else { 0. }, |motion| {
				motion.transition.value(FOLD)
			})
	}

	pub fn moving(&self) -> bool {
		!self.moving.is_empty()
	}

	/// Drops the motions that ended. Call once a frame, before drawing.
	pub fn settle(&mut self) {
		self.moving
			.retain(|_, motion| motion.transition.is_moving(FOLD));
	}

	/// `content` as `key`'s block: its full height when settled, else cropped to how far it has opened.
	pub fn block(&self, key: &K, content: impl IntoElement) -> AnyElement {
		match self.moving.get(key) {
			Some(motion) => crop(
				content,
				motion.transition.value(FOLD),
				motion.transition.is_open(),
				&motion.height,
			),
			None => content.into_any_element(),
		}
	}
}

/// A content's laid-out height, kept between frames.
pub type Measured = Rc<Cell<Option<Pixels>>>;

/// @description `content` cropped to `progress` of its height, which it records in `height` as it lays out.
/// @param opening Before the first layout, an open starts from nothing and a close from the full height.
pub fn crop(
	content: impl IntoElement,
	progress: f32,
	opening: bool,
	height: &Measured,
) -> AnyElement {
	let measured = height.get();
	let height = height.clone();
	div()
		.flex_none()
		.flex()
		.flex_col()
		.overflow_hidden()
		.map(|block| match measured {
			Some(full) => block.h(full * progress),
			None if opening => block.h(px(0.)),
			None => block,
		})
		.on_children_prepainted(move |bounds, _, _| {
			if let Some(content) = bounds.first() {
				height.set(Some(content.size.height));
			}
		})
		.child(div().flex_none().w_full().child(content))
		.into_any_element()
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn a_settled_key_is_as_its_owner_says() {
		let mut accordion = Accordion::default();
		assert!(!accordion.shows(&1, false));
		assert_eq!(accordion.progress(&1, true), 1.);
		accordion.toggle(1, false, false);
		assert!(accordion.shows(&1, false));
		assert!(accordion.progress(&1, false) > 0.9);
		accordion.toggle(2, true, true);
		assert!(!accordion.moving.contains_key(&2));
	}
}
