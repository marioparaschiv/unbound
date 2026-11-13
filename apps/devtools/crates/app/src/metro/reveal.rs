//! Opening the tree at a search match: each key of the match's path is found among the open
//! value's children, fetching its first page, or the next page while the key is not listed yet.
//! The row it ends on glides to the middle of the pane and flickers.

use std::rc::Rc;

use gpui::{Context, px};

use super::tree::{Fetch, Node, Path, Row as TreeRow, Step};
use super::{Exports, MetroBrowser};
use crate::smooth_scroll::GlideTo;
use crate::theme;

/// The tree's list pads its top by this much, so row `n` starts at `PAD + n * height`.
pub(super) const TREE_PAD: f32 = 6.;

/// The keys still to open, and the steps found for those already open.
pub(super) struct Reveal {
	pub keys: Vec<String>,
	pub at: Vec<Step>,
}

/// The revealed row; a new `token` replays its flicker.
pub(super) struct Flash {
	pub path: Path,
	pub token: u64,
}

/// Where a key stands among a value's children.
#[derive(Debug, PartialEq)]
enum Lookup {
	Found(Step),
	/// Not listed yet; fetch the page from this offset.
	Page(u32),
	/// A page is loading.
	Wait,
	/// Every child is listed and none has the key, or the page failed.
	Missing,
}

/// Finds `key` among `node`'s children: a slot such as `[[Prototype]]` first, then a property.
fn lookup(node: &Node, key: &str) -> Lookup {
	let Some(children) = &node.children else {
		return Lookup::Page(0);
	};
	match children.fetch {
		Fetch::Loading => return Lookup::Wait,
		Fetch::Failed(_) => return Lookup::Missing,
		Fetch::Idle => {}
	}
	if let Some(ix) = children.slots.iter().position(|slot| slot.value.key == key) {
		return Lookup::Found(Step::Slot(ix));
	}
	if let Some(ix) = children
		.properties
		.iter()
		.position(|child| child.value.key == key)
	{
		return Lookup::Found(Step::Property(ix));
	}
	let listed = children.properties.len() as u32;
	if listed < children.total {
		Lookup::Page(listed)
	} else {
		Lookup::Missing
	}
}

impl MetroBrowser {
	/// Opens the next keys of the reveal in flight, until one needs the device; the last one found
	/// glides into view and flickers.
	pub(super) fn advance_reveal(&mut self, cx: &mut Context<Self>) {
		loop {
			let Some(picked) = self.picked.as_mut() else {
				return;
			};
			let Some(reveal) = picked.reveal.as_mut() else {
				return;
			};
			let Exports::Loaded(root) = &mut picked.exports else {
				return;
			};
			let at: Path = reveal.at.iter().copied().collect();
			let Some(node) = root.at(&at) else {
				picked.reveal = None;
				return;
			};
			let Some(key) = reveal.keys.get(reveal.at.len()) else {
				self.finish_reveal(at, cx);
				return;
			};
			if !node.value.expandable() {
				self.finish_reveal(at, cx);
				return;
			}
			node.expanded = true;
			match lookup(node, key) {
				Lookup::Found(step) => reveal.at.push(step),
				Lookup::Page(offset) => {
					self.fetch_children(at, offset, cx);
					return;
				}
				Lookup::Wait => return,
				Lookup::Missing => {
					self.finish_reveal(at, cx);
					return;
				}
			}
		}
	}

	fn finish_reveal(&mut self, path: Path, cx: &mut Context<Self>) {
		self.rebuild_tree();
		let Some(picked) = self.picked.as_mut() else {
			return;
		};
		picked.reveal = None;
		let row = picked.rows.iter().position(
			|row| matches!(row, TreeRow::Value { path: row_path, .. } if *row_path == path),
		);
		let token = self.tree_glide.map_or(1, |glide| glide.token + 1);
		picked.flash = Some(Flash {
			path: Rc::clone(&path),
			token,
		});
		if let Some(row) = row {
			let height = theme::VALUE_ROW_HEIGHT;
			self.tree_glide = Some(GlideTo {
				token,
				y: px(TREE_PAD) + height * row as f32,
				height,
			});
		}
		cx.notify();
	}
}

/// How lit a flashing row is at `delta` (0 to 1) of its animation: held while the tree glides
/// there, two blinks, then settled to 0 above the row's resting highlight.
pub(super) fn flicker(delta: f32) -> f32 {
	let t = ((delta - 0.2) / 0.8).clamp(0., 1.);
	(1. - t) * (0.5 + 0.5 * (2. * std::f32::consts::TAU * t).cos())
}

/// The key's sideways hop in pixels at `delta`: one quick bump as the row arrives.
pub(super) fn hop(delta: f32) -> f32 {
	let t = (delta / 0.25).clamp(0., 1.);
	4. * (std::f32::consts::PI * t).sin()
}

#[cfg(test)]
mod tests {
	use unbound_devtools_core::{ChildrenPage, MetroValue, MetroValueKind};

	use super::*;

	fn value(key: &str) -> MetroValue {
		MetroValue {
			key: key.into(),
			kind: MetroValueKind::Object,
			text: "Object {…}".into(),
			value_ref: Some(format!("r:{key}")),
			internal: key.starts_with("[["),
		}
	}

	fn node(keys: &[&str], total: u32) -> Node {
		let mut node = Node::new(value("module.exports"));
		node.add_page(
			ChildrenPage {
				value: value("module.exports"),
				children: keys.iter().map(|key| value(key)).collect(),
				total,
				internal: vec![value("[[Prototype]]")],
			},
			true,
		);
		node
	}

	#[test]
	fn a_key_is_found_in_the_slots_or_the_listed_properties() {
		let node = node(&["a", "b"], 2);
		assert_eq!(lookup(&node, "b"), Lookup::Found(Step::Property(1)));
		assert_eq!(lookup(&node, "[[Prototype]]"), Lookup::Found(Step::Slot(0)));
		assert_eq!(lookup(&node, "c"), Lookup::Missing);
	}

	#[test]
	fn an_unlisted_key_asks_for_the_next_page() {
		assert_eq!(lookup(&node(&["a"], 300), "z"), Lookup::Page(1));
		assert_eq!(lookup(&Node::new(value("x")), "z"), Lookup::Page(0));
	}

	#[test]
	fn the_flicker_blinks_then_settles() {
		assert_eq!(flicker(0.), 1.);
		assert!(flicker(0.4) < 0.01);
		assert!(flicker(0.6) > 0.3);
		assert!(flicker(1.) < 0.01);
		assert!(hop(0.125) > 3.9 && hop(0.5).abs() < 0.001);
	}
}
