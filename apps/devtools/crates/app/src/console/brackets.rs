//! Bracket structure of the Console's buffer, read past strings, template text and comments: which
//! bracket pairs with the one at the caret, and whether the input is still open, so Enter adds a
//! line instead of running half an expression.

#[derive(Clone, Copy, PartialEq)]
enum Mode {
	Code,
	Quote(char),
	Template,
	LineComment,
	BlockComment,
}

/// A bracket's byte offset and character.
type Bracket = (usize, char);

struct Scan {
	/// Brackets in code, in order.
	brackets: Vec<Bracket>,
	/// Where the scan ended: inside a template or block comment means the input goes on.
	mode: Mode,
	/// Whether it ended inside a template's `${`.
	in_substitution: bool,
}

fn opener(close: char) -> char {
	match close {
		')' => '(',
		']' => '[',
		_ => '{',
	}
}

fn scan(text: &str) -> Scan {
	let mut brackets = Vec::new();
	let mut mode = Mode::Code;
	// One entry per open `{`: true when it is a template's `${`, whose `}` returns to the template.
	let mut braces: Vec<bool> = Vec::new();
	let mut chars = text.char_indices().peekable();
	while let Some((at, c)) = chars.next() {
		let next = chars.peek().map(|&(_, next)| next);
		match (mode, c) {
			(Mode::Code, '\'' | '"') => mode = Mode::Quote(c),
			(Mode::Code, '`') => mode = Mode::Template,
			(Mode::Code, '/') if next == Some('/') => mode = Mode::LineComment,
			(Mode::Code, '/') if next == Some('*') => {
				chars.next();
				mode = Mode::BlockComment;
			}
			(Mode::Code, '(' | '[') => brackets.push((at, c)),
			(Mode::Code, '{') => {
				braces.push(false);
				brackets.push((at, c));
			}
			(Mode::Code, ')' | ']') => brackets.push((at, c)),
			(Mode::Code, '}') => {
				if braces.pop() == Some(true) {
					mode = Mode::Template;
				} else {
					brackets.push((at, c));
				}
			}
			(Mode::Quote(_) | Mode::Template, '\\') => {
				chars.next();
			}
			(Mode::Quote(quote), _) if c == quote || c == '\n' => mode = Mode::Code,
			(Mode::Template, '`') => mode = Mode::Code,
			(Mode::Template, '$') if next == Some('{') => {
				chars.next();
				braces.push(true);
				mode = Mode::Code;
			}
			(Mode::LineComment, '\n') => mode = Mode::Code,
			(Mode::BlockComment, '*') if next == Some('/') => {
				chars.next();
				mode = Mode::Code;
			}
			_ => {}
		}
	}

	Scan {
		brackets,
		mode,
		in_substitution: braces.contains(&true),
	}
}

/// Pairs each closer with its opener; returns the pairs and the openers left open.
fn pair(brackets: &[Bracket]) -> (Vec<(usize, usize)>, Vec<Bracket>) {
	let mut pairs = Vec::new();
	let mut open: Vec<Bracket> = Vec::new();
	for &(at, c) in brackets {
		if matches!(c, '(' | '[' | '{') {
			open.push((at, c));
		} else if open.last().is_some_and(|&(_, last)| last == opener(c)) {
			let (start, _) = open.pop().unwrap_or_default();
			pairs.push((start, at));
		}
	}

	(pairs, open)
}

/// The offsets of the bracket touching `cursor` (just before it first, then just after) and its
/// partner, or `None` when no paired bracket touches the caret.
pub fn matching(text: &str, cursor: usize) -> Option<(usize, usize)> {
	let (pairs, _) = pair(&scan(text).brackets);
	let touches = |at: usize| {
		pairs
			.iter()
			.find(|&&(open, close)| open == at || close == at)
	};
	let before = cursor.checked_sub(1).and_then(touches);

	before.or_else(|| touches(cursor)).copied()
}

/// Whether Enter at `cursor` should add a line rather than run: the input has an unclosed
/// bracket, template or block comment, or the caret is inside a `{ }` block, as after typing `{`.
pub fn continues_input(text: &str, cursor: usize) -> bool {
	let (_, open) = pair(&scan(text.get(..cursor).unwrap_or(text)).brackets);

	is_open(text) || open.last().is_some_and(|&(_, c)| c == '{')
}

/// Whether the input has an unclosed bracket, template or block comment.
fn is_open(text: &str) -> bool {
	let scan = scan(text);
	let (_, open) = pair(&scan.brackets);

	!open.is_empty()
		|| scan.in_substitution
		|| matches!(scan.mode, Mode::Template | Mode::BlockComment)
}

#[cfg(test)]
mod tests {
	use super::{continues_input, is_open, matching};

	#[test]
	fn matches_the_bracket_before_or_after_the_caret() {
		let text = "f(a[0], { b })";
		assert_eq!(matching(text, 2), Some((1, 13)));
		assert_eq!(matching(text, 1), Some((1, 13)));
		assert_eq!(matching(text, 8), Some((8, 12)));
		assert_eq!(matching(text, 10), None);
	}

	#[test]
	fn skips_brackets_in_strings_and_comments() {
		let text = "f(')', \"[\", /* ( */ x) // (";
		assert_eq!(matching(text, 2), Some((1, 21)));
		assert!(!is_open(text));
	}

	#[test]
	fn reads_template_substitutions_as_code() {
		let text = "`a ${f(1)} }`";
		assert_eq!(matching(text, 7), Some((6, 8)));
		assert!(!is_open(text));
		assert!(is_open("`a ${"));
	}

	#[test]
	fn knows_when_the_input_is_still_open() {
		assert!(is_open("if (x) {"));
		assert!(is_open("foo(1,"));
		assert!(is_open("/* note"));
		assert!(!is_open("foo(1)"));
		assert!(!is_open("a)"));
	}

	#[test]
	fn adds_a_line_inside_a_block_but_runs_inside_a_call() {
		assert!(continues_input("if (x) {}", 8));
		assert!(!continues_input("if (x) {}", 9));
		assert!(!continues_input("foo('User')", 10));
		assert!(continues_input("foo(", 4));
	}
}
