//! Whole-line edits for the Console editor: comment, move, duplicate, delete and select the lines a
//! selection touches. Each returns one replacement, so the editor records it as one undo step.

use std::ops::Range;

const COMMENT: &str = "// ";

/// Replace `range` with `text`, then select `selection`.
#[derive(Debug, PartialEq)]
pub struct LineEdit {
	pub range: Range<usize>,
	pub text: String,
	pub selection: Range<usize>,
}

fn line_start(text: &str, offset: usize) -> usize {
	text[..offset].rfind('\n').map_or(0, |at| at + 1)
}

fn line_end(text: &str, offset: usize) -> usize {
	text[offset..]
		.find('\n')
		.map_or(text.len(), |at| offset + at)
}

/// The lines `selection` touches, without the last newline. A selection ending at a line's start
/// leaves that line out, as a triple-click selection does.
fn block(text: &str, selection: &Range<usize>) -> Range<usize> {
	let end = if selection.end > selection.start && line_start(text, selection.end) == selection.end
	{
		selection.end - 1
	} else {
		selection.end
	};

	line_start(text, selection.start)..line_end(text, end)
}

fn shift(range: &Range<usize>, by: isize) -> Range<usize> {
	range.start.saturating_add_signed(by)..range.end.saturating_add_signed(by)
}

/// Where `offset` lands after `edits` (sorted, non-overlapping) apply; inside a removed span it
/// moves to the span's start.
fn map(offset: usize, edits: &[(Range<usize>, &str)]) -> usize {
	let mut delta = 0isize;
	for (range, text) in edits {
		if offset >= range.end {
			delta += text.len() as isize - range.len() as isize;
		} else if offset > range.start {
			return range.start.saturating_add_signed(delta);
		}
	}

	offset.saturating_add_signed(delta)
}

/// Comments the lines out with `// ` at their shared indent, or uncomments them when every
/// non-blank line already starts with `//`.
pub fn toggle_comment(text: &str, selection: Range<usize>) -> LineEdit {
	let range = block(text, &selection);
	let mut starts = vec![range.start];
	starts.extend(
		text[range.clone()]
			.match_indices('\n')
			.map(|(at, _)| range.start + at + 1),
	);
	let lines: Vec<(usize, &str)> = starts
		.iter()
		.map(|&start| (start, &text[start..line_end(text, start)]))
		.collect();
	let code = || lines.iter().filter(|(_, line)| !line.trim().is_empty());
	let indent = |line: &str| line.len() - line.trim_start().len();
	let commented =
		code().count() > 0 && code().all(|(_, line)| line.trim_start().starts_with("//"));
	let edits: Vec<(Range<usize>, &str)> = if commented {
		code()
			.map(|&(start, line)| {
				let at = start + indent(line);
				let marker = if line.trim_start().starts_with(COMMENT) {
					COMMENT.len()
				} else {
					2
				};
				(at..at + marker, "")
			})
			.collect()
	} else {
		let shared = code().map(|(_, line)| indent(line)).min().unwrap_or(0);
		let blank = code().count() == 0;
		lines
			.iter()
			.filter(|(_, line)| blank || !line.trim().is_empty())
			.map(|&(start, _)| (start + shared..start + shared, COMMENT))
			.collect()
	};
	let mut out = String::new();
	let mut at = range.start;
	for (edit, insert) in &edits {
		out.push_str(&text[at..edit.start]);
		out.push_str(insert);
		at = edit.end;
	}
	out.push_str(&text[at..range.end]);

	LineEdit {
		range,
		text: out,
		selection: map(selection.start, &edits)..map(selection.end, &edits),
	}
}

/// Swaps the lines with the line above (`up`) or below; `None` at the buffer's edge.
pub fn move_lines(text: &str, selection: Range<usize>, up: bool) -> Option<LineEdit> {
	let range = block(text, &selection);
	let lines = &text[range.clone()];
	if up {
		let above = line_start(text, range.start.checked_sub(1)?);
		let neighbour = &text[above..range.start - 1];
		return Some(LineEdit {
			range: above..range.end,
			text: format!("{lines}\n{neighbour}"),
			selection: shift(&selection, -(neighbour.len() as isize + 1)),
		});
	}
	if range.end == text.len() {
		return None;
	}
	let below = line_end(text, range.end + 1);
	let neighbour = &text[range.end + 1..below];

	Some(LineEdit {
		range: range.start..below,
		text: format!("{neighbour}\n{lines}"),
		selection: shift(&selection, neighbour.len() as isize + 1),
	})
}

/// Copies the lines below themselves and selects the copy.
pub fn duplicate_lines(text: &str, selection: Range<usize>) -> LineEdit {
	let range = block(text, &selection);
	let lines = &text[range.clone()];

	LineEdit {
		range: range.end..range.end,
		text: format!("\n{lines}"),
		selection: shift(&selection, lines.len() as isize + 1),
	}
}

/// Deletes the lines and their newline; the caret stays at the same column where it can.
pub fn delete_lines(text: &str, selection: Range<usize>) -> LineEdit {
	let range = block(text, &selection);
	let removed = if range.end < text.len() {
		range.start..range.end + 1
	} else {
		range.start.saturating_sub(1)..range.end
	};
	let rest = format!("{}{}", &text[..removed.start], &text[removed.end..]);
	let column = selection.start - range.start;
	let start = line_start(&rest, removed.start.min(rest.len()));
	let caret = (start + column).min(line_end(&rest, start));

	LineEdit {
		range: removed,
		text: String::new(),
		selection: caret..caret,
	}
}

/// The lines the selection touches, newline included; a selection that already is whole lines
/// grows by the next line.
pub fn select_lines(text: &str, selection: Range<usize>) -> Range<usize> {
	let range = block(text, &selection);
	let whole = |range: &Range<usize>| range.start..(range.end + 1).min(text.len());
	let lines = whole(&range);
	if selection == lines && lines.end < text.len() {
		return whole(&(range.start..line_end(text, lines.end)));
	}

	lines
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn comments_at_the_shared_indent_and_back() {
		let text = "a\n  b\n\n  c";
		let edit = toggle_comment(text, 2..text.len());
		assert_eq!(edit.range, 2..text.len());
		assert_eq!(edit.text, "  // b\n\n  // c");
		let commented = format!("a\n{}", edit.text);
		let back = toggle_comment(&commented, 2..commented.len());
		assert_eq!(back.text, "  b\n\n  c");
	}

	#[test]
	fn keeps_the_caret_on_its_character_when_commenting() {
		let edit = toggle_comment("foo()", 3..3);
		assert_eq!(edit.text, "// foo()");
		assert_eq!(edit.selection, 6..6);
		assert_eq!(toggle_comment("// foo()", 6..6).selection, 3..3);
	}

	#[test]
	fn moves_lines_past_their_neighbour() {
		let text = "one\ntwo\nthree";
		let up = move_lines(text, 5..5, true).unwrap();
		assert_eq!(
			(up.range, up.text.as_str(), up.selection),
			(0..7, "two\none", 1..1)
		);
		let down = move_lines(text, 5..5, false).unwrap();
		assert_eq!(down.text, "three\ntwo");
		assert_eq!(down.selection, 11..11);
		assert_eq!(move_lines(text, 1..1, true), None);
		assert_eq!(move_lines(text, 9..9, false), None);
	}

	#[test]
	fn duplicates_deletes_and_selects_lines() {
		let text = "one\ntwo";
		let copy = duplicate_lines(text, 1..1);
		assert_eq!(
			(copy.range, copy.text.as_str(), copy.selection),
			(3..3, "\none", 5..5)
		);
		assert_eq!(delete_lines(text, 1..1).range, 0..4);
		assert_eq!(delete_lines(text, 5..5).range, 3..7);
		assert_eq!(delete_lines(text, 5..5).selection, 1..1);
		assert_eq!(select_lines(text, 1..1), 0..4);
		assert_eq!(select_lines(text, 0..4), 0..7);
	}
}
