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

/// A run of coloured text: part of a [`Highlighted`], or several parts joined into one line.
#[derive(Clone, Default)]
pub struct Piece {
	pub text: String,
	styles: Vec<(Range<usize>, HighlightStyle)>,
}

impl Piece {
	pub fn plain(text: impl Into<String>) -> Self {
		Self {
			text: text.into(),
			styles: Vec::new(),
		}
	}

	/// Adds `other` after this piece.
	pub fn push(&mut self, other: &Piece) {
		let shift = self.text.len();
		self.text.push_str(&other.text);
		self.styles.extend(
			other
				.styles
				.iter()
				.map(|(range, style)| (range.start + shift..range.end + shift, *style)),
		);
	}

	pub fn styled(self) -> StyledText {
		StyledText::new(self.text).with_highlights(self.styles)
	}
}

impl Highlighted {
	pub fn new(text: impl Into<SharedString>) -> Self {
		Self {
			text: text.into(),
			theme: None,
			styles: Vec::new(),
		}
	}

	pub fn text(&self) -> &str {
		&self.text
	}

	/// Colours the text for the current theme, once per theme.
	pub fn refresh(&mut self, cx: &App) {
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
	}

	/// The text coloured for the current theme.
	pub fn styled(&mut self, cx: &App) -> StyledText {
		self.refresh(cx);
		StyledText::new(self.text.clone()).with_highlights(self.styles.clone())
	}

	/// `range` of the text with its colours, as last refreshed.
	pub fn slice(&self, range: Range<usize>) -> Piece {
		let styles = self
			.styles
			.iter()
			.filter(|(styled, _)| styled.start < range.end && styled.end > range.start)
			.map(|(styled, style)| {
				let start = styled.start.max(range.start) - range.start;
				let end = styled.end.min(range.end) - range.start;
				(start..end, *style)
			})
			.collect();
		Piece {
			text: self.text[range].to_owned(),
			styles,
		}
	}
}
