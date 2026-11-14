//! The editor's completions and hovers, answered by the shared tsrs checker on a background thread.

use anyhow::anyhow;
use gpui::{App, Task, WeakEntity, Window};
use gpui_component::input::{CompletionProvider, HoverProvider, Rope, RopeExt};
use lsp_types::{
	CompletionContext, CompletionItem, CompletionResponse, CompletionTextEdit, Hover, Range,
	TextEdit,
};
use unbound_devtools_repl::checker;

use super::assist::Assist;

/// Answers the editor with nothing and hands tsrs's answers to [`Assist`], which draws them.
pub struct Types {
	pub assist: WeakEntity<Assist>,
}

/// Characters that start or continue a name, or reach into one with `.`.
fn triggers(text: &str) -> bool {
	text.chars()
		.any(|c| c.is_alphanumeric() || matches!(c, '.' | '_' | '$'))
}

/// Where the name being typed just before `offset` starts.
fn name_start(text: &str, offset: usize) -> usize {
	let before = text.get(..offset).unwrap_or(text);

	before
		.char_indices()
		.rev()
		.take_while(|(_, c)| c.is_alphanumeric() || matches!(c, '_' | '$'))
		.last()
		.map_or(before.len(), |(index, _)| index)
}

/// Keeps the items containing `prefix` (any case), those starting with it first, then tsrs's order.
/// Items without an edit replace `range`, the typed name; the menu's own range can start earlier.
fn narrow(response: CompletionResponse, prefix: &str, range: Range) -> Vec<CompletionItem> {
	let items = match response {
		CompletionResponse::Array(items) => items,
		CompletionResponse::List(list) => list.items,
	};
	let mut items: Vec<(bool, CompletionItem)> = items
		.into_iter()
		.filter_map(|mut item| {
			let label = item.label.to_lowercase();
			if item.text_edit.is_none() {
				item.text_edit = Some(CompletionTextEdit::Edit(TextEdit {
					range,
					new_text: item
						.insert_text
						.clone()
						.unwrap_or_else(|| item.label.clone()),
				}));
			}
			label
				.contains(prefix)
				.then(|| (!label.starts_with(prefix), item))
		})
		.collect();
	items.sort_by(|(a_late, a), (b_late, b)| {
		a_late
			.cmp(b_late)
			.then_with(|| a.sort_text.cmp(&b.sort_text))
			.then_with(|| a.label.cmp(&b.label))
	});

	items.into_iter().map(|(_, item)| item).collect()
}

impl CompletionProvider for Types {
	fn completions(
		&self,
		text: &Rope,
		offset: usize,
		_: CompletionContext,
		_: &mut Window,
		cx: &mut App,
	) -> Task<anyhow::Result<CompletionResponse>> {
		let buffer = text.to_string();
		let position = text.offset_to_position(offset);
		let start = name_start(&buffer, offset);
		let prefix = buffer.get(start..offset).unwrap_or_default().to_lowercase();
		let range = Range::new(text.offset_to_position(start), position);
		let assist = self.assist.clone();
		cx.spawn(async move |cx| {
			let (buffer, items) = cx
				.background_executor()
				.spawn(async move {
					let response = checker::shared()
						.map_err(|error| anyhow!(error))?
						.completions(&buffer, position)?;

					anyhow::Ok((buffer, narrow(response, &prefix, range)))
				})
				.await?;
			assist.update(cx, |assist, cx| {
				assist.show_completions(buffer, offset, start, items, cx);
			})?;

			// The Console draws the menu; gpui-component's stays closed.
			Ok(CompletionResponse::Array(Vec::new()))
		})
	}

	fn is_completion_trigger(&self, _: usize, new_text: &str, _: &mut App) -> bool {
		triggers(new_text)
	}
}

impl HoverProvider for Types {
	fn hover(
		&self,
		text: &Rope,
		offset: usize,
		_: &mut Window,
		cx: &mut App,
	) -> Task<anyhow::Result<Option<Hover>>> {
		let buffer = text.to_string();
		let position = text.offset_to_position(offset);
		let assist = self.assist.clone();
		cx.spawn(async move |cx| {
			let (buffer, hover) = cx
				.background_executor()
				.spawn(async move {
					let hover = checker::shared()
						.map_err(|error| anyhow!(error))?
						.hover(&buffer, position)?;

					anyhow::Ok((buffer, hover))
				})
				.await?;
			assist.update(cx, |assist, cx| {
				assist.show_hover(buffer, offset, hover, cx)
			})?;

			// The Console draws the card; gpui-component's stays closed.
			Ok(None)
		})
	}
}
