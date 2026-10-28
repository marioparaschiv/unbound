//! A single-line text input, adapted from Zed's `crates/gpui/examples/input.rs`. GPUI ships no
//! text field; this one supports typing, IME marking, selection, and the clipboard.

use std::ops::Range;

use gpui::{
	App, Bounds, ClipboardItem, Context, CursorStyle, ElementId, ElementInputHandler, Entity,
	EntityInputHandler, EventEmitter, FocusHandle, Focusable, GlobalElementId, KeyBinding,
	LayoutId, MouseButton, MouseDownEvent, MouseMoveEvent, MouseUpEvent, PaintQuad, Pixels, Point,
	ShapedLine, SharedString, Style, TextRun, UTF16Selection, UnderlineStyle, Window, actions,
	fill, point, prelude::*, px, relative, size,
};
use unicode_segmentation::UnicodeSegmentation;

use crate::theme;

actions!(
	text_input,
	[
		Backspace,
		Delete,
		Left,
		Right,
		SelectLeft,
		SelectRight,
		SelectAll,
		Home,
		End,
		Paste,
		Cut,
		Copy
	]
);

const CONTEXT: &str = "TextInput";

/// Select all, paste, copy, cut: `cmd` on macOS, `ctrl` elsewhere. GPUI's `secondary-` alias fails
/// to parse here because bindings are made before a keyboard OS is known.
const CLIPBOARD_KEYS: [&str; 4] = if cfg!(target_os = "macos") {
	["cmd-a", "cmd-v", "cmd-c", "cmd-x"]
} else {
	["ctrl-a", "ctrl-v", "ctrl-c", "ctrl-x"]
};

pub fn bind_keys(cx: &mut App) {
	let context = Some(CONTEXT);
	let [select_all, paste, copy, cut] = CLIPBOARD_KEYS;
	cx.bind_keys([
		KeyBinding::new("backspace", Backspace, context),
		KeyBinding::new("delete", Delete, context),
		KeyBinding::new("left", Left, context),
		KeyBinding::new("right", Right, context),
		KeyBinding::new("shift-left", SelectLeft, context),
		KeyBinding::new("shift-right", SelectRight, context),
		KeyBinding::new(select_all, SelectAll, context),
		KeyBinding::new(paste, Paste, context),
		KeyBinding::new(copy, Copy, context),
		KeyBinding::new(cut, Cut, context),
		KeyBinding::new("home", Home, context),
		KeyBinding::new("end", End, context),
	]);
}

/// Emitted whenever the text changes.
pub struct Changed;

pub struct TextInput {
	focus_handle: FocusHandle,
	content: SharedString,
	placeholder: SharedString,
	selected_range: Range<usize>,
	selection_reversed: bool,
	marked_range: Option<Range<usize>>,
	last_layout: Option<ShapedLine>,
	last_bounds: Option<Bounds<Pixels>>,
	is_selecting: bool,
}

impl EventEmitter<Changed> for TextInput {}

impl TextInput {
	pub fn new(placeholder: impl Into<SharedString>, cx: &mut Context<Self>) -> Self {
		Self {
			focus_handle: cx.focus_handle(),
			content: SharedString::default(),
			placeholder: placeholder.into(),
			selected_range: 0..0,
			selection_reversed: false,
			marked_range: None,
			last_layout: None,
			last_bounds: None,
			is_selecting: false,
		}
	}

	pub fn text(&self) -> &str {
		&self.content
	}

	pub fn clear(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		if self.content.is_empty() {
			return;
		}
		self.content = SharedString::default();
		self.selected_range = 0..0;
		self.selection_reversed = false;
		self.marked_range = None;
		window.notify_text_input_changed(&self.focus_handle);
		cx.emit(Changed);
		cx.notify();
	}

	fn left(&mut self, _: &Left, window: &mut Window, cx: &mut Context<Self>) {
		if self.selected_range.is_empty() {
			self.move_to(self.previous_boundary(self.cursor_offset()), window, cx);
		} else {
			self.move_to(self.selected_range.start, window, cx);
		}
	}

	fn right(&mut self, _: &Right, window: &mut Window, cx: &mut Context<Self>) {
		if self.selected_range.is_empty() {
			self.move_to(self.next_boundary(self.selected_range.end), window, cx);
		} else {
			self.move_to(self.selected_range.end, window, cx);
		}
	}

	fn select_left(&mut self, _: &SelectLeft, window: &mut Window, cx: &mut Context<Self>) {
		self.select_to(self.previous_boundary(self.cursor_offset()), window, cx);
	}

	fn select_right(&mut self, _: &SelectRight, window: &mut Window, cx: &mut Context<Self>) {
		self.select_to(self.next_boundary(self.cursor_offset()), window, cx);
	}

	fn select_all(&mut self, _: &SelectAll, window: &mut Window, cx: &mut Context<Self>) {
		self.move_to(0, window, cx);
		self.select_to(self.content.len(), window, cx);
	}

	fn home(&mut self, _: &Home, window: &mut Window, cx: &mut Context<Self>) {
		self.move_to(0, window, cx);
	}

	fn end(&mut self, _: &End, window: &mut Window, cx: &mut Context<Self>) {
		self.move_to(self.content.len(), window, cx);
	}

	fn backspace(&mut self, _: &Backspace, window: &mut Window, cx: &mut Context<Self>) {
		if self.selected_range.is_empty() {
			let previous = self.previous_boundary(self.cursor_offset());
			if self.cursor_offset() == previous {
				return;
			}
			self.select_to(previous, window, cx);
		}
		self.replace_text_in_range(None, "", window, cx);
	}

	fn delete(&mut self, _: &Delete, window: &mut Window, cx: &mut Context<Self>) {
		if self.selected_range.is_empty() {
			let next = self.next_boundary(self.cursor_offset());
			if self.cursor_offset() == next {
				return;
			}
			self.select_to(next, window, cx);
		}
		self.replace_text_in_range(None, "", window, cx);
	}

	fn on_mouse_down(
		&mut self,
		event: &MouseDownEvent,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		self.is_selecting = true;
		window.focus(&self.focus_handle, cx);
		let index = self.index_for_mouse_position(event.position);
		if event.modifiers.shift {
			self.select_to(index, window, cx);
		} else {
			self.move_to(index, window, cx);
		}
	}

	fn on_mouse_up(&mut self, _: &MouseUpEvent, _: &mut Window, _: &mut Context<Self>) {
		self.is_selecting = false;
	}

	fn on_mouse_move(
		&mut self,
		event: &MouseMoveEvent,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		if self.is_selecting {
			self.select_to(self.index_for_mouse_position(event.position), window, cx);
		}
	}

	fn paste(&mut self, _: &Paste, window: &mut Window, cx: &mut Context<Self>) {
		if let Some(text) = cx.read_from_clipboard().and_then(|item| item.text()) {
			self.replace_text_in_range(None, &text.replace('\n', " "), window, cx);
		}
	}

	fn copy(&mut self, _: &Copy, _: &mut Window, cx: &mut Context<Self>) {
		if !self.selected_range.is_empty() {
			let text = self.content[self.selected_range.clone()].to_string();
			cx.write_to_clipboard(ClipboardItem::new_string(text));
		}
	}

	fn cut(&mut self, _: &Cut, window: &mut Window, cx: &mut Context<Self>) {
		if !self.selected_range.is_empty() {
			let text = self.content[self.selected_range.clone()].to_string();
			cx.write_to_clipboard(ClipboardItem::new_string(text));
			self.replace_text_in_range(None, "", window, cx);
		}
	}

	fn move_to(&mut self, offset: usize, window: &Window, cx: &mut Context<Self>) {
		self.selected_range = offset..offset;
		self.selection_reversed = false;
		window.notify_text_selection_changed(&self.focus_handle);
		cx.notify();
	}

	fn cursor_offset(&self) -> usize {
		if self.selection_reversed {
			self.selected_range.start
		} else {
			self.selected_range.end
		}
	}

	fn index_for_mouse_position(&self, position: Point<Pixels>) -> usize {
		if self.content.is_empty() {
			return 0;
		}
		let (Some(bounds), Some(line)) = (self.last_bounds.as_ref(), self.last_layout.as_ref())
		else {
			return 0;
		};
		if position.y < bounds.top() {
			return 0;
		}
		if position.y > bounds.bottom() {
			return self.content.len();
		}
		line.closest_index_for_x(position.x - bounds.left())
	}

	fn select_to(&mut self, offset: usize, window: &Window, cx: &mut Context<Self>) {
		if self.selection_reversed {
			self.selected_range.start = offset;
		} else {
			self.selected_range.end = offset;
		}
		if self.selected_range.end < self.selected_range.start {
			self.selection_reversed = !self.selection_reversed;
			self.selected_range = self.selected_range.end..self.selected_range.start;
		}
		window.notify_text_selection_changed(&self.focus_handle);
		cx.notify();
	}

	fn offset_from_utf16(&self, offset: usize) -> usize {
		let mut utf8_offset = 0;
		let mut utf16_count = 0;
		for ch in self.content.chars() {
			if utf16_count >= offset {
				break;
			}
			utf16_count += ch.len_utf16();
			utf8_offset += ch.len_utf8();
		}
		utf8_offset
	}

	fn offset_to_utf16(&self, offset: usize) -> usize {
		let mut utf16_offset = 0;
		let mut utf8_count = 0;
		for ch in self.content.chars() {
			if utf8_count >= offset {
				break;
			}
			utf8_count += ch.len_utf8();
			utf16_offset += ch.len_utf16();
		}
		utf16_offset
	}

	fn range_to_utf16(&self, range: &Range<usize>) -> Range<usize> {
		self.offset_to_utf16(range.start)..self.offset_to_utf16(range.end)
	}

	fn range_from_utf16(&self, range_utf16: &Range<usize>) -> Range<usize> {
		self.offset_from_utf16(range_utf16.start)..self.offset_from_utf16(range_utf16.end)
	}

	fn previous_boundary(&self, offset: usize) -> usize {
		self.content
			.grapheme_indices(true)
			.rev()
			.find_map(|(idx, _)| (idx < offset).then_some(idx))
			.unwrap_or(0)
	}

	fn next_boundary(&self, offset: usize) -> usize {
		self.content
			.grapheme_indices(true)
			.find_map(|(idx, _)| (idx > offset).then_some(idx))
			.unwrap_or(self.content.len())
	}

	fn splice(&mut self, range: Range<usize>, new_text: &str) {
		self.content =
			(self.content[..range.start].to_owned() + new_text + &self.content[range.end..]).into();
	}
}

impl EntityInputHandler for TextInput {
	fn text_for_range(
		&mut self,
		range_utf16: Range<usize>,
		actual_range: &mut Option<Range<usize>>,
		_: &mut Window,
		_: &mut Context<Self>,
	) -> Option<String> {
		let range = self.range_from_utf16(&range_utf16);
		actual_range.replace(self.range_to_utf16(&range));
		Some(self.content[range].to_string())
	}

	fn selected_text_range(
		&mut self,
		_: bool,
		_: &mut Window,
		_: &mut Context<Self>,
	) -> Option<UTF16Selection> {
		Some(UTF16Selection {
			range: self.range_to_utf16(&self.selected_range),
			reversed: self.selection_reversed,
		})
	}

	fn set_selected_text_range(
		&mut self,
		range_utf16: Range<usize>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		self.selected_range = self.range_from_utf16(&range_utf16);
		self.selection_reversed = false;
		window.notify_text_selection_changed(&self.focus_handle);
		cx.notify();
	}

	fn text_length_utf16(&mut self, _: &mut Window, _: &mut Context<Self>) -> Option<usize> {
		Some(self.content.encode_utf16().count())
	}

	fn marked_text_range(&self, _: &mut Window, _: &mut Context<Self>) -> Option<Range<usize>> {
		self.marked_range
			.as_ref()
			.map(|range| self.range_to_utf16(range))
	}

	fn unmark_text(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		self.marked_range = None;
		window.notify_text_input_changed(&self.focus_handle);
		cx.notify();
	}

	fn replace_text_in_range(
		&mut self,
		range_utf16: Option<Range<usize>>,
		new_text: &str,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		let range = range_utf16
			.as_ref()
			.map(|range| self.range_from_utf16(range))
			.or(self.marked_range.clone())
			.unwrap_or(self.selected_range.clone());
		self.splice(range.clone(), new_text);
		self.selected_range = range.start + new_text.len()..range.start + new_text.len();
		self.selection_reversed = false;
		self.marked_range = None;
		window.notify_text_input_changed(&self.focus_handle);
		cx.emit(Changed);
		cx.notify();
	}

	fn replace_and_mark_text_in_range(
		&mut self,
		range_utf16: Option<Range<usize>>,
		new_text: &str,
		new_selected_range_utf16: Option<Range<usize>>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) {
		let range = range_utf16
			.as_ref()
			.map(|range| self.range_from_utf16(range))
			.or(self.marked_range.clone())
			.unwrap_or(self.selected_range.clone());
		self.splice(range.clone(), new_text);
		self.marked_range =
			(!new_text.is_empty()).then(|| range.start..range.start + new_text.len());
		let start_utf16 = self.offset_to_utf16(range.start);
		let inserted_utf16 = new_text.encode_utf16().count();
		self.selected_range = new_selected_range_utf16
			.map(|selected| {
				self.range_from_utf16(
					&(start_utf16 + selected.start.min(inserted_utf16)
						..start_utf16 + selected.end.min(inserted_utf16)),
				)
			})
			.unwrap_or_else(|| range.start + new_text.len()..range.start + new_text.len());
		self.selection_reversed = false;
		window.notify_text_input_changed(&self.focus_handle);
		cx.emit(Changed);
		cx.notify();
	}

	fn bounds_for_range(
		&mut self,
		range_utf16: Range<usize>,
		bounds: Bounds<Pixels>,
		_: &mut Window,
		_: &mut Context<Self>,
	) -> Option<Bounds<Pixels>> {
		let layout = self.last_layout.as_ref()?;
		if layout.text != self.content {
			return None;
		}
		let range = self.range_from_utf16(&range_utf16);
		Some(Bounds::from_corners(
			point(
				bounds.left() + layout.x_for_index(range.start),
				bounds.top(),
			),
			point(
				bounds.left() + layout.x_for_index(range.end),
				bounds.bottom(),
			),
		))
	}

	fn selection_bounds_for_range(
		&mut self,
		range_utf16: Range<usize>,
		bounds: Bounds<Pixels>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> Vec<Bounds<Pixels>> {
		self.bounds_for_range(range_utf16, bounds, window, cx)
			.into_iter()
			.collect()
	}

	fn character_index_for_point(
		&mut self,
		point: Point<Pixels>,
		_: &mut Window,
		_: &mut Context<Self>,
	) -> Option<usize> {
		let local = self.last_bounds?.localize(&point)?;
		let layout = self.last_layout.as_ref()?;
		if layout.text != self.content {
			return None;
		}
		Some(self.offset_to_utf16(layout.closest_index_for_x(local.x)))
	}
}

struct TextElement {
	input: Entity<TextInput>,
}

struct PrepaintState {
	line: Option<ShapedLine>,
	cursor: Option<PaintQuad>,
	selection: Option<PaintQuad>,
}

impl IntoElement for TextElement {
	type Element = Self;

	fn into_element(self) -> Self::Element {
		self
	}
}

impl Element for TextElement {
	type RequestLayoutState = ();
	type PrepaintState = PrepaintState;

	fn id(&self) -> Option<ElementId> {
		None
	}

	fn source_location(&self) -> Option<&'static core::panic::Location<'static>> {
		None
	}

	fn request_layout(
		&mut self,
		_: Option<&GlobalElementId>,
		_: Option<&gpui::InspectorElementId>,
		window: &mut Window,
		cx: &mut App,
	) -> (LayoutId, Self::RequestLayoutState) {
		let mut style = Style::default();
		style.size.width = relative(1.).into();
		style.size.height = window.line_height().into();
		(window.request_layout(style, [], cx), ())
	}

	fn prepaint(
		&mut self,
		_: Option<&GlobalElementId>,
		_: Option<&gpui::InspectorElementId>,
		bounds: Bounds<Pixels>,
		_: &mut Self::RequestLayoutState,
		window: &mut Window,
		cx: &mut App,
	) -> Self::PrepaintState {
		let input = self.input.read(cx);
		let selected_range = input.selected_range.clone();
		let cursor = input.cursor_offset();
		let style = window.text_style();
		let (text, color) = if input.content.is_empty() {
			(input.placeholder.clone(), theme::hsla(theme::TEXT_MUTED))
		} else {
			(input.content.clone(), style.color)
		};
		let run = TextRun {
			len: text.len(),
			font: style.font(),
			color,
			background_color: None,
			underline: None,
			strikethrough: None,
		};
		let runs = match input.marked_range.as_ref() {
			Some(marked) => [
				TextRun {
					len: marked.start,
					..run.clone()
				},
				TextRun {
					len: marked.end - marked.start,
					underline: Some(UnderlineStyle {
						color: Some(run.color),
						thickness: px(1.),
						wavy: false,
					}),
					..run.clone()
				},
				TextRun {
					len: text.len() - marked.end,
					..run
				},
			]
			.into_iter()
			.filter(|run| run.len > 0)
			.collect(),
			None => vec![run],
		};
		let font_size = style.font_size.to_pixels(window.rem_size());
		let line = window
			.text_system()
			.shape_line(text, font_size, &runs, None);
		let height = bounds.bottom() - bounds.top();
		let (selection, cursor) = if selected_range.is_empty() {
			let x = if input.content.is_empty() {
				px(0.)
			} else {
				line.x_for_index(cursor)
			};
			let caret = Bounds::new(
				point(bounds.left() + x, bounds.top()),
				size(px(1.5), height),
			);
			(None, Some(fill(caret, theme::color(theme::ACCENT))))
		} else {
			let start = bounds.left() + line.x_for_index(selected_range.start);
			let end = bounds.left() + line.x_for_index(selected_range.end);
			let quad =
				Bounds::from_corners(point(start, bounds.top()), point(end, bounds.bottom()));
			(Some(fill(quad, theme::alpha(theme::ACCENT, 0.3))), None)
		};
		PrepaintState {
			line: Some(line),
			cursor,
			selection,
		}
	}

	fn paint(
		&mut self,
		_: Option<&GlobalElementId>,
		_: Option<&gpui::InspectorElementId>,
		bounds: Bounds<Pixels>,
		_: &mut Self::RequestLayoutState,
		prepaint: &mut Self::PrepaintState,
		window: &mut Window,
		cx: &mut App,
	) {
		let focus_handle = self.input.read(cx).focus_handle.clone();
		window.handle_input(
			&focus_handle,
			ElementInputHandler::new(bounds, self.input.clone()),
			cx,
		);
		if let Some(selection) = prepaint.selection.take() {
			window.paint_quad(selection);
		}
		let Some(line) = prepaint.line.take() else {
			return;
		};
		line.paint(
			bounds.origin,
			window.line_height(),
			gpui::TextAlign::Left,
			None,
			window,
			cx,
		)
		.ok();
		if focus_handle.is_focused(window)
			&& let Some(cursor) = prepaint.cursor.take()
		{
			window.paint_quad(cursor);
		}
		let has_content = !self.input.read(cx).content.is_empty();
		self.input.update(cx, |input, _| {
			input.last_layout = has_content.then_some(line);
			input.last_bounds = Some(bounds);
		});
	}
}

impl Render for TextInput {
	fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		gpui::div()
			.flex()
			.flex_1()
			.min_w_0()
			.overflow_hidden()
			.key_context(CONTEXT)
			.track_focus(&self.focus_handle)
			.cursor(CursorStyle::IBeam)
			.on_action(cx.listener(Self::backspace))
			.on_action(cx.listener(Self::delete))
			.on_action(cx.listener(Self::left))
			.on_action(cx.listener(Self::right))
			.on_action(cx.listener(Self::select_left))
			.on_action(cx.listener(Self::select_right))
			.on_action(cx.listener(Self::select_all))
			.on_action(cx.listener(Self::home))
			.on_action(cx.listener(Self::end))
			.on_action(cx.listener(Self::paste))
			.on_action(cx.listener(Self::cut))
			.on_action(cx.listener(Self::copy))
			.on_mouse_down(MouseButton::Left, cx.listener(Self::on_mouse_down))
			.on_mouse_up(MouseButton::Left, cx.listener(Self::on_mouse_up))
			.on_mouse_up_out(MouseButton::Left, cx.listener(Self::on_mouse_up))
			.on_mouse_move(cx.listener(Self::on_mouse_move))
			.child(TextElement { input: cx.entity() })
	}
}

impl Focusable for TextInput {
	fn focus_handle(&self, _: &App) -> FocusHandle {
		self.focus_handle.clone()
	}
}
