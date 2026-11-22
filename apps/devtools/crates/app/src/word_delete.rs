//! Alt+Backspace and Alt+Delete (also Ctrl on Linux and Windows) delete one word in every text field,
//! as VS Code does: `unbound.metro.findByProps` loses `findByProps`, where gpui-component's Unicode word
//! rules take the whole dotted path.

use std::ops::Range;

use gpui::{App, InteractiveElement, KeyBinding, Window, actions};
use gpui_component::WindowExt as _;
use gpui_component::input::AnyInputState;

actions!(word_delete, [DeleteWordLeft, DeleteWordRight]);

/// gpui-component's text fields' key context.
const INPUT: &str = "Input";

/// Binds the word deletes over gpui-component's own; call after `gpui_component::init`.
pub fn bind_keys(cx: &mut App) {
	let input = Some(INPUT);
	cx.bind_keys([
		KeyBinding::new("alt-backspace", DeleteWordLeft, input),
		KeyBinding::new("alt-delete", DeleteWordRight, input),
	]);
	#[cfg(not(target_os = "macos"))]
	cx.bind_keys([
		KeyBinding::new("ctrl-backspace", DeleteWordLeft, input),
		KeyBinding::new("ctrl-delete", DeleteWordRight, input),
	]);
}

/// `element` handling the word deletes for whichever text field inside it has focus.
pub fn handle<E: InteractiveElement>(element: E) -> E {
	element
		.on_action(|_: &DeleteWordLeft, window, cx| delete(true, window, cx))
		.on_action(|_: &DeleteWordRight, window, cx| delete(false, window, cx))
}

/// Deletes the focused field's selection, or the word before (`back`) or after its caret.
fn delete(back: bool, window: &mut Window, cx: &mut App) {
	macro_rules! edit {
		($state:expr) => {
			$state.update(cx, |state, cx| {
				if !state.is_editable() {
					return;
				}
				let selection = state.selected_range();
				let range = if selection.is_empty() {
					word_range(&state.value(), selection.start, back)
				} else {
					selection
				};
				if range.is_empty() {
					return;
				}
				state.set_selected_range(range, cx);
				state.replace("", window, cx);
			})
		};
	}
	match window.focused_input(cx) {
		Some(AnyInputState::Input(state)) => edit!(state),
		Some(AnyInputState::Textarea(state)) => edit!(state),
		Some(AnyInputState::Editor(state)) => edit!(state),
		_ => {}
	}
}

fn is_blank(c: char) -> bool {
	c == ' ' || c == '\t'
}

fn is_word(c: char) -> bool {
	c.is_alphanumeric() || c == '_' || c == '$'
}

/// @description The text one word delete takes from `at`: a line break, else the blanks there and then
/// one run of word characters or of punctuation, stopping at the line's edge.
/// @param back Toward the start of `text`, else toward its end.
/// @returns A byte range ending (`back`) or starting at `at`.
pub fn word_range(text: &str, at: usize, back: bool) -> Range<usize> {
	let mut chars: Box<dyn Iterator<Item = (usize, char)>> = if back {
		Box::new(text[..at].char_indices().rev())
	} else {
		Box::new(text[at..].char_indices().map(|(ix, c)| (at + ix, c)))
	};
	let mut edge = at;
	// The far side of character `ix`, toward where the delete runs.
	let past = |ix: usize, c: char| if back { ix } else { ix + c.len_utf8() };
	let mut kind = None;
	for (ix, c) in &mut chars {
		if c == '\n' {
			if edge == at {
				edge = past(ix, c);
			}
			break;
		}
		match kind {
			None if is_blank(c) => {}
			None => kind = Some(is_word(c)),
			Some(word) if is_blank(c) || is_word(c) != word => break,
			Some(_) => {}
		}
		edge = past(ix, c);
	}
	if back { edge..at } else { at..edge }
}

#[cfg(test)]
mod tests {
	use super::word_range;

	/// `text` with `|` as the caret, after one delete.
	fn delete(text: &str, back: bool) -> String {
		let at = text.find('|').unwrap();
		let text = text.replace('|', "");
		let range = word_range(&text, at, back);
		format!("{}|{}", &text[..range.start], &text[range.end..])
	}

	#[test]
	fn back_takes_one_identifier_of_a_dotted_path() {
		assert_eq!(
			delete("unbound.metro.findByProps|", true),
			"unbound.metro.|"
		);
		assert_eq!(delete("unbound.metro.|", true), "unbound.metro|");
		assert_eq!(delete("$1.user_id|", true), "$1.|");
	}

	#[test]
	fn back_takes_blanks_then_a_run() {
		assert_eq!(delete("let foo   |", true), "let |");
		assert_eq!(delete("foo()|", true), "foo|");
		assert_eq!(delete("héllo wörld|", true), "héllo |");
		assert_eq!(delete("|abc", true), "|abc");
	}

	#[test]
	fn back_stops_at_the_line() {
		assert_eq!(delete("a\n|b", true), "a|b");
		assert_eq!(delete("a\n   |b", true), "a\n|b");
	}

	#[test]
	fn forward_mirrors_back() {
		assert_eq!(delete("|findByProps.x", false), "|.x");
		assert_eq!(delete("|   bar baz", false), "| baz");
		assert_eq!(delete("a|\nb", false), "a|b");
		assert_eq!(delete("a|  \nb", false), "a|\nb");
		assert_eq!(delete("abc|", false), "abc|");
	}
}
