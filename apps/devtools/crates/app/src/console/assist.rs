//! The Console editor's completion menu and hover card. tsrs answers through [`super::types`];
//! these draw the answers in Unbound's popover style instead of gpui-component's, and only while
//! the editor still holds the text they were asked about.

use std::ops::Range;
use std::time::Duration;

use gpui::{Context, Entity, ScrollHandle, SharedString, Subscription, Task, Window};
use gpui_component::input::{EditorState, RopeExt};
use lsp_types::{CompletionItem, Hover, HoverContents, MarkedString};

use super::highlight::Highlighted;

/// How long the hover card outlives the pointer leaving the editor, so it can reach the card.
const HOVER_GRACE: Duration = Duration::from_millis(200);

pub struct Completions {
	/// The editor text and cursor they answer.
	buffer: String,
	offset: usize,
	/// Where the name being completed starts; the menu lines up with it.
	pub start: usize,
	pub items: Vec<CompletionItem>,
}

pub struct HoverCard {
	buffer: String,
	pub range: Range<usize>,
	pub signature: Option<Highlighted>,
	pub docs: Option<SharedString>,
}

pub struct Assist {
	pub editor: Entity<EditorState>,
	pub completions: Option<Completions>,
	pub selected: usize,
	pub menu_scroll: ScrollHandle,
	pub hover: Option<HoverCard>,
	/// Whether the pointer is on the editor or on the card.
	pointer_on_editor: bool,
	pointer_on_card: bool,
	hide_hover: Option<Task<()>>,
	_observe: Subscription,
}

/// Splits tsrs's hover markdown into the leading fenced signature and the docs after it.
fn split_hover(markdown: &str) -> (Option<String>, String) {
	let text = markdown.trim();
	let Some(rest) = text.strip_prefix("```") else {
		return (None, text.to_owned());
	};
	let Some((_, body)) = rest.split_once('\n') else {
		return (None, text.to_owned());
	};
	let Some(end) = body.find("\n```") else {
		return (None, text.to_owned());
	};
	let docs = body[end + 4..]
		.trim_start()
		.trim_start_matches("---")
		.trim();

	(Some(body[..end].trim().to_owned()), docs.to_owned())
}

fn hover_markdown(contents: HoverContents) -> String {
	let marked = |item: MarkedString| match item {
		MarkedString::String(text) => text,
		MarkedString::LanguageString(code) => format!("```{}\n{}\n```", code.language, code.value),
	};
	match contents {
		HoverContents::Scalar(item) => marked(item),
		HoverContents::Array(items) => items
			.into_iter()
			.map(marked)
			.collect::<Vec<_>>()
			.join("\n\n"),
		HoverContents::Markup(markup) => markup.value,
	}
}

impl Assist {
	pub fn new(editor: Entity<EditorState>, cx: &mut Context<Self>) -> Self {
		// Typing and caret moves can make an answer stale; a repaint drops it.
		let observe = cx.observe(&editor, |_, _, cx| cx.notify());
		Self {
			editor,
			completions: None,
			selected: 0,
			menu_scroll: ScrollHandle::new(),
			hover: None,
			pointer_on_editor: false,
			pointer_on_card: false,
			hide_hover: None,
			_observe: observe,
		}
	}

	fn is_current(&self, buffer: &str, offset: Option<usize>, cx: &gpui::App) -> bool {
		let editor = self.editor.read(cx);

		editor.value().as_ref() == buffer && offset.is_none_or(|offset| editor.cursor() == offset)
	}

	/// The completions, if they still answer the editor's text and caret.
	pub fn live_completions(&self, cx: &gpui::App) -> Option<&Completions> {
		self.completions.as_ref().filter(|list| {
			!list.items.is_empty() && self.is_current(&list.buffer, Some(list.offset), cx)
		})
	}

	/// The hover card, if the editor still holds the text it describes and no menu covers it.
	pub fn live_hover(&self, cx: &gpui::App) -> bool {
		self.live_completions(cx).is_none()
			&& self
				.hover
				.as_ref()
				.is_some_and(|card| self.is_current(&card.buffer, None, cx))
	}

	pub fn show_completions(
		&mut self,
		buffer: String,
		offset: usize,
		start: usize,
		items: Vec<CompletionItem>,
		cx: &mut Context<Self>,
	) {
		self.completions = Some(Completions {
			buffer,
			offset,
			start,
			items,
		});
		self.selected = 0;
		self.menu_scroll.scroll_to_item(0);
		cx.notify();
	}

	pub fn show_hover(
		&mut self,
		buffer: String,
		offset: usize,
		hover: Option<Hover>,
		cx: &mut Context<Self>,
	) {
		let Some(hover) = hover else {
			self.hover = None;
			cx.notify();
			return;
		};
		let text = self.editor.read(cx).text().clone();
		let range = hover
			.range
			.map(|range| text.position_to_offset(&range.start)..text.position_to_offset(&range.end))
			.or_else(|| text.word_range(offset))
			.unwrap_or(offset..offset);
		// The same symbol again: keep the card and its colours.
		if self
			.hover
			.as_ref()
			.is_some_and(|card| card.range == range && card.buffer == buffer)
		{
			return;
		}
		let (signature, docs) = split_hover(&hover_markdown(hover.contents));
		self.hover = Some(HoverCard {
			buffer,
			range,
			signature: signature.map(Highlighted::new),
			docs: (!docs.is_empty()).then(|| docs.into()),
		});
		cx.notify();
	}

	/// Closes the menu; false when none was showing.
	pub fn dismiss_completions(&mut self, cx: &mut Context<Self>) -> bool {
		let open = self.live_completions(cx).is_some();
		self.completions = None;
		cx.notify();
		open
	}

	/// Moves the menu's selection, wrapping; false when no menu is showing.
	pub fn move_selection(&mut self, delta: isize, cx: &mut Context<Self>) -> bool {
		let Some(count) = self.live_completions(cx).map(|list| list.items.len()) else {
			return false;
		};
		self.selected = (self.selected as isize + delta).rem_euclid(count as isize) as usize;
		self.menu_scroll.scroll_to_item(self.selected);
		cx.notify();
		true
	}

	/// Inserts the selected completion; false when no menu is showing.
	pub fn accept(&mut self, window: &mut Window, cx: &mut Context<Self>) -> bool {
		let Some(list) = self.live_completions(cx) else {
			return false;
		};
		let Some(item) = list.items.get(self.selected).cloned() else {
			return false;
		};
		let range = list.start..list.offset;
		self.completions = None;
		self.editor.update(cx, |editor, cx| {
			editor.insert_completion(&item, range, window, cx);
		});
		cx.notify();
		true
	}

	pub fn set_pointer_on_editor(&mut self, on: bool, cx: &mut Context<Self>) {
		self.pointer_on_editor = on;
		self.schedule_hover_hide(cx);
	}

	pub fn set_pointer_on_card(&mut self, on: bool, cx: &mut Context<Self>) {
		self.pointer_on_card = on;
		self.schedule_hover_hide(cx);
	}

	/// Hides the card once the pointer has left both the editor and the card.
	fn schedule_hover_hide(&mut self, cx: &mut Context<Self>) {
		if self.pointer_on_editor || self.pointer_on_card {
			self.hide_hover = None;
			return;
		}
		self.hide_hover = Some(cx.spawn(async move |this, cx| {
			cx.background_executor().timer(HOVER_GRACE).await;
			this.update(cx, |this, cx| {
				if !this.pointer_on_editor && !this.pointer_on_card {
					this.hover = None;
					cx.notify();
				}
			})
			.ok();
		}));
	}
}

#[cfg(test)]
mod tests {
	use super::split_hover;

	#[test]
	fn splits_signature_from_docs() {
		let (signature, docs) =
			split_hover("```typescript\nconst unbound: UnboundGlobal\n```\n---\nThe API.");
		assert_eq!(signature.as_deref(), Some("const unbound: UnboundGlobal"));
		assert_eq!(docs, "The API.");
	}

	#[test]
	fn keeps_plain_markdown_as_docs() {
		assert_eq!(split_hover("Just *docs*"), (None, "Just *docs*".to_owned()));
	}
}
