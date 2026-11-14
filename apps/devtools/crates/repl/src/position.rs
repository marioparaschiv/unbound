//! Column conversion between the editor and tsrs. gpui-component's editor counts a column in
//! characters; LSP counts UTF-16 code units, so an emoji is one column to one and two to the other.

use lsp_types::{Position, Range};

fn line(text: &str, line: u32) -> &str {
	text.split('\n').nth(line as usize).unwrap_or_default()
}

/// An editor position as tsrs counts it.
pub fn to_lsp(text: &str, position: Position) -> Position {
	let character = line(text, position.line)
		.chars()
		.take(position.character as usize)
		.map(char::len_utf16)
		.sum::<usize>();

	Position::new(position.line, character as u32)
}

/// A tsrs position as the editor counts it.
pub fn from_lsp(text: &str, position: Position) -> Position {
	let mut units = 0;
	let character = line(text, position.line)
		.chars()
		.take_while(|c| {
			units += c.len_utf16();
			units <= position.character as usize
		})
		.count();

	Position::new(position.line, character as u32)
}

/// A tsrs range as the editor counts it.
pub fn range_from_lsp(text: &str, range: Range) -> Range {
	Range::new(from_lsp(text, range.start), from_lsp(text, range.end))
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn counts_an_emoji_as_one_column_in_the_editor_and_two_in_lsp() {
		let text = "x\nconst s = '😀'; s.len";
		let editor = Position::new(1, 17);
		let lsp = to_lsp(text, editor);
		assert_eq!(lsp, Position::new(1, 18));
		assert_eq!(from_lsp(text, lsp), editor);
	}

	#[test]
	fn leaves_ascii_alone() {
		let position = Position::new(0, 3);
		assert_eq!(to_lsp("abcdef", position), position);
		assert_eq!(from_lsp("abcdef", position), position);
	}
}
