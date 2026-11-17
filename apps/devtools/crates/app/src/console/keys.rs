//! The Console editor's keys beyond gpui-component's: whole-line edits, comment toggling, asking
//! for completions or the signature, and word moves with Alt on Linux and Windows as on macOS.

use std::ops::Range;

use gpui::{App, Context, KeyBinding, Window, actions};
use gpui_component::input::ShowCompletions;
#[cfg(not(target_os = "macos"))]
use gpui_component::input::{
	DeleteToNextWordEnd, DeleteToPreviousWordStart, MoveToNextWord, MoveToPreviousWord,
	SelectToNextWordEnd, SelectToPreviousWordStart,
};

use super::Console;
use super::lines::{self, LineEdit};

/// The key context around the Console's editor.
pub const CONTEXT: &str = "ConsoleEditor";

actions!(
	console,
	[
		ToggleComment,
		MoveLinesUp,
		MoveLinesDown,
		DuplicateLines,
		DeleteLines,
		SelectLines,
		ShowSignature
	]
);

/// `key` with Cmd on macOS and Ctrl elsewhere. `KeyBinding::new` can't resolve gpui's `secondary`.
macro_rules! primary {
	($key:literal) => {
		if cfg!(target_os = "macos") {
			concat!("cmd-", $key)
		} else {
			concat!("ctrl-", $key)
		}
	};
}

/// Binds the Console editor's keys.
pub fn bind_keys(cx: &mut App) {
	let editor = Some(CONTEXT);
	cx.bind_keys([
		KeyBinding::new(primary!("/"), ToggleComment, editor),
		KeyBinding::new("alt-up", MoveLinesUp, editor),
		KeyBinding::new("alt-down", MoveLinesDown, editor),
		KeyBinding::new(primary!("shift-d"), DuplicateLines, editor),
		KeyBinding::new(primary!("shift-k"), DeleteLines, editor),
		KeyBinding::new(primary!("l"), SelectLines, editor),
		KeyBinding::new(primary!("shift-space"), ShowSignature, editor),
		KeyBinding::new("ctrl-space", ShowCompletions, editor),
	]);
	// gpui-component binds these on macOS only; every text field gets them here.
	#[cfg(not(target_os = "macos"))]
	{
		let input = Some("Input");
		cx.bind_keys([
			KeyBinding::new("alt-left", MoveToPreviousWord, input),
			KeyBinding::new("alt-right", MoveToNextWord, input),
			KeyBinding::new("alt-shift-left", SelectToPreviousWordStart, input),
			KeyBinding::new("alt-shift-right", SelectToNextWordEnd, input),
			KeyBinding::new("alt-backspace", DeleteToPreviousWordStart, input),
			KeyBinding::new("alt-delete", DeleteToNextWordEnd, input),
		]);
	}
}

impl Console {
	/// Applies a whole-line edit to the editor's selection as one undo step.
	fn edit_lines(
		&mut self,
		edit: impl FnOnce(&str, Range<usize>) -> Option<LineEdit>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		self.editor.update(cx, |editor, cx| {
			let text = editor.value().to_string();
			let Some(edit) = edit(&text, editor.selected_range()) else {
				return;
			};
			editor.set_selected_range(edit.range, cx);
			editor.replace(edit.text, window, cx);
			editor.set_selected_range(edit.selection, cx);
		});
	}

	pub fn toggle_comment(
		&mut self,
		_: &ToggleComment,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		self.edit_lines(
			|text, selection| Some(lines::toggle_comment(text, selection)),
			window,
			cx,
		);
	}

	pub fn move_lines_up(&mut self, _: &MoveLinesUp, window: &mut Window, cx: &mut Context<Self>) {
		self.edit_lines(
			|text, selection| lines::move_lines(text, selection, true),
			window,
			cx,
		);
	}

	pub fn move_lines_down(
		&mut self,
		_: &MoveLinesDown,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		self.edit_lines(
			|text, selection| lines::move_lines(text, selection, false),
			window,
			cx,
		);
	}

	pub fn duplicate_lines(
		&mut self,
		_: &DuplicateLines,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		self.edit_lines(
			|text, selection| Some(lines::duplicate_lines(text, selection)),
			window,
			cx,
		);
	}

	pub fn delete_lines(&mut self, _: &DeleteLines, window: &mut Window, cx: &mut Context<Self>) {
		self.edit_lines(
			|text, selection| Some(lines::delete_lines(text, selection)),
			window,
			cx,
		);
	}

	pub fn select_lines(&mut self, _: &SelectLines, _: &mut Window, cx: &mut Context<Self>) {
		self.editor.update(cx, |editor, cx| {
			let range = lines::select_lines(&editor.value(), editor.selected_range());
			editor.set_selected_range(range, cx);
		});
	}

	pub fn show_signature(&mut self, _: &ShowSignature, _: &mut Window, cx: &mut Context<Self>) {
		self.assist
			.update(cx, |assist, cx| assist.refresh_signature(true, cx));
	}
}
