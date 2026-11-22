//! The Logs list as screen lines: every shown log line, and under each open one its message wrapped to
//! the list's width a screen line per row, so the list stays uniform and folds like the trees.

use std::ops::Range;
use std::rc::Rc;

use gpui::SharedString;

/// A log line opened to its whole message.
pub(super) struct Opened {
	/// Its place among the shown log lines.
	pub at: usize,
	pub seq: u64,
	pub level: u8,
	pub lines: Rc<[SharedString]>,
}

/// What a screen line shows.
#[derive(Clone, Copy, Debug, PartialEq)]
pub(super) enum Line {
	/// The shown log line at this place.
	Entry(usize),
	/// Line `line` of the message of [`LineMap::opened`]`[opened]`.
	Detail { opened: usize, line: usize },
}

/// Where each shown log line and each open message line sits on screen.
#[derive(Default)]
pub(super) struct LineMap {
	/// Sorted by `at`.
	pub opened: Vec<Opened>,
	total: usize,
}

impl LineMap {
	pub fn new(entries: usize, mut opened: Vec<Opened>) -> Self {
		opened.sort_by_key(|opened| opened.at);
		let total = entries
			+ opened
				.iter()
				.map(|opened| opened.lines.len())
				.sum::<usize>();
		Self { opened, total }
	}

	pub fn len(&self) -> usize {
		self.total
	}

	/// What screen line `ix` shows.
	pub fn line(&self, ix: usize) -> Option<Line> {
		if ix >= self.total {
			return None;
		}
		let mut before = 0;
		for (k, opened) in self.opened.iter().enumerate() {
			let entry = opened.at + before;
			if ix <= entry {
				return Some(Line::Entry(ix - before));
			}
			if ix <= entry + opened.lines.len() {
				return Some(Line::Detail {
					opened: k,
					line: ix - entry - 1,
				});
			}
			before += opened.lines.len();
		}
		Some(Line::Entry(ix - before))
	}

	/// The screen lines of `seq`'s message, when it is open.
	pub fn block(&self, seq: u64) -> Option<Range<usize>> {
		let mut before = 0;
		for opened in &self.opened {
			let entry = opened.at + before;
			if opened.seq == seq {
				return Some(entry + 1..entry + 1 + opened.lines.len());
			}
			before += opened.lines.len();
		}
		None
	}
}

/// @description `text` broken into lines of at most `width` characters, at spaces where it can.
pub(super) fn wrap(text: &str, width: usize) -> Vec<SharedString> {
	let width = width.max(8);
	let mut lines = Vec::new();
	for line in text.lines() {
		let chars: Vec<char> = line.chars().collect();
		if chars.is_empty() {
			lines.push(SharedString::default());
			continue;
		}
		let mut start = 0;
		while start < chars.len() {
			let mut end = (start + width).min(chars.len());
			if end < chars.len() {
				// Breaks after the last space in the second half, so a word moves down whole.
				if let Some(space) = chars[start + width / 2..end]
					.iter()
					.rposition(|c| *c == ' ')
				{
					end = start + width / 2 + space + 1;
				}
			}
			lines.push(chars[start..end].iter().collect::<String>().into());
			start = end;
		}
	}
	lines
}

#[cfg(test)]
mod tests {
	use super::*;

	fn opened(at: usize, seq: u64, lines: usize) -> Opened {
		Opened {
			at,
			seq,
			level: 1,
			lines: (0..lines).map(|_| SharedString::default()).collect(),
		}
	}

	#[test]
	fn open_messages_sit_under_their_lines() {
		let map = LineMap::new(5, vec![opened(3, 30, 1), opened(1, 10, 2)]);
		assert_eq!(map.len(), 8);
		let lines: Vec<_> = (0..8).map(|ix| map.line(ix).unwrap()).collect();
		assert_eq!(lines[1], Line::Entry(1));
		assert_eq!(lines[2], Line::Detail { opened: 0, line: 0 });
		assert_eq!(lines[3], Line::Detail { opened: 0, line: 1 });
		assert_eq!(lines[5], Line::Entry(3));
		assert_eq!(lines[6], Line::Detail { opened: 1, line: 0 });
		assert_eq!(lines[7], Line::Entry(4));
		assert_eq!(map.block(10), Some(2..4));
		assert_eq!(map.block(30), Some(6..7));
		assert_eq!(map.line(8), None);
	}

	#[test]
	fn wraps_at_spaces_and_keeps_line_breaks() {
		assert_eq!(wrap("aaaa bbbb cccc", 10), vec!["aaaa bbbb ", "cccc"]);
		assert_eq!(wrap("x\n\ny", 10), vec!["x", "", "y"]);
		assert_eq!(wrap(&"z".repeat(20), 8).len(), 3);
	}
}
