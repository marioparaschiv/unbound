//! Colours the Console's entries with the editor's TypeScript highlighter. Result previews are
//! JS-like (`User { id: "1" }`), so the same grammar colours their keys, strings and literals.

use std::ops::Range;
use std::sync::Arc;

use gpui::{App, HighlightStyle, SharedString, StyledText};
use gpui_component::Theme;
use gpui_component::highlighter::{HighlightTheme, SyntaxHighlighter};
use gpui_component::input::Rope;

const LANGUAGE: &str = "typescript";

/// Text plus its syntax colours, kept until the theme changes so renders don't reparse.
pub struct Highlighted {
	text: SharedString,
	theme: Option<Arc<HighlightTheme>>,
	styles: Vec<(Range<usize>, HighlightStyle)>,
}

impl Highlighted {
	pub fn new(text: impl Into<SharedString>) -> Self {
		Self {
			text: text.into(),
			theme: None,
			styles: Vec::new(),
		}
	}

	/// The text coloured for the current theme.
	pub fn styled(&mut self, cx: &App) -> StyledText {
		let theme = &Theme::global(cx).highlight_theme;
		if self
			.theme
			.as_ref()
			.is_none_or(|current| !Arc::ptr_eq(current, theme))
		{
			let mut highlighter = SyntaxHighlighter::new(LANGUAGE);
			highlighter.update(None, &Rope::from_str(&self.text), None);
			self.styles = highlighter.styles(&(0..self.text.len()), theme.as_ref());
			self.theme = Some(theme.clone());
		}

		StyledText::new(self.text.clone()).with_highlights(self.styles.clone())
	}
}
