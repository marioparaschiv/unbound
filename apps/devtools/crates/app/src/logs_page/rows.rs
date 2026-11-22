//! The Logs page's rows: a chevron, the time, a coloured source tag, the level, the scope, then the
//! message's first line. A line whose message does not fit opens to the whole message under it.
//! Only the rows on screen are drawn.

use std::ops::Range;

use gpui::{
	AnyElement, ClipboardItem, Context, SharedString, Window, div, font, prelude::*, px,
	uniform_list,
};
use unbound_devtools_core::{LogEntry, LogSource};

use super::LogsPage;
use super::lines::Line;
use crate::smooth_scroll::SmoothScroll;
use crate::theme::{self, Token};
use crate::widgets::{badge, icon_button, mono_char_width, text_width, tooltip, turning_chevron};

const TIME_WIDTH: f32 = 92.;
const LEVEL_WIDTH: f32 = 40.;
const GAP: f32 = 8.;
/// A row's left padding: the chevron slot stands in for most of the inset.
const ROW_LEAD: f32 = 2.;
/// How much of a row's width is padding: the list's 4px each side, then the row's own.
const ROW_PADDING: f32 = 8. + ROW_LEAD + theme::INSET;
/// The badge's text size and its padding on each side.
const BADGE_TEXT: f32 = 11.;
const BADGE_PAD: f32 = 5.;
/// The hover group of a row, which reveals its copy button.
const ROW_GROUP: &str = "log-row";

fn source_tone(source: LogSource) -> Token {
	match source {
		LogSource::Unbound => theme::ACCENT_HOVER,
		LogSource::Js => theme::SYN_FUNCTION,
		LogSource::ReactNative => theme::SYN_PROP_KEY,
		LogSource::Native => theme::SYN_LITERAL,
	}
}

fn level_tone(level: u8) -> Token {
	match level {
		3 => theme::ERROR,
		2 => theme::WARNING,
		_ => theme::TEXT_FAINT,
	}
}

fn message_tone(level: u8) -> Token {
	match level {
		3 => theme::ERROR,
		2 => theme::WARNING,
		_ => theme::TEXT,
	}
}

/// The line's local wall-clock time, to the millisecond.
fn clock(entry: &LogEntry) -> String {
	chrono::DateTime::<chrono::Local>::from(entry.time())
		.format("%H:%M:%S%.3f")
		.to_string()
}

/// The message's first line, marked when more follow, since every row is one line high.
fn first_line(message: &str) -> String {
	match message.split_once('\n') {
		Some((first, _)) => format!("{first} …"),
		None => message.to_owned(),
	}
}

/// The whole line, as its copy button copies it.
fn copy_text(entry: &LogEntry) -> String {
	let line = &entry.line;
	let scope = if line.scope.is_empty() {
		String::new()
	} else {
		format!(" [{}]", line.scope.join(" → "))
	};
	format!(
		"{} {} {}{scope} {}",
		clock(entry),
		line.source().label(),
		line.level_label(),
		line.message
	)
}

/// The columns' measures for the lines shown, read once a frame.
#[derive(Clone, Copy, Default)]
pub(super) struct Columns {
	/// As wide as the widest tag among the lines shown.
	pub source: f32,
	/// One monospace character.
	pub char: f32,
	/// The width the open messages wrap to, in characters.
	pub wrap: usize,
}

impl Columns {
	/// Measures the columns for `sources`, the tags among the lines shown, in a list `width` wide.
	pub fn measure(window: &Window, sources: &[LogSource], width: f32) -> Self {
		let ui = font(theme::ui_font());
		let source = sources
			.iter()
			.map(|source| {
				let label = SharedString::new_static(source.label());
				text_width(window, label, ui.clone(), px(BADGE_TEXT))
			})
			.fold(0., f32::max)
			+ 2. * BADGE_PAD;
		let char = mono_char_width(window);
		let mut columns = Self {
			source,
			char,
			wrap: 0,
		};
		let room = width - ROW_PADDING - columns.detail_indent();
		columns.wrap = (room / char.max(1.)).floor().max(8.) as usize;
		columns
	}

	/// Where an open message's lines start: under the level.
	fn detail_indent(&self) -> f32 {
		theme::CHEVRON_SLOT + TIME_WIDTH + self.source + 3. * GAP
	}

	/// Whether `entry`'s message runs past its row, so the row opens.
	pub fn overflows(&self, entry: &LogEntry) -> bool {
		let line = &entry.line;
		let scope: usize = line.scope.iter().map(|part| part.chars().count() + 3).sum();
		let room = self
			.wrap
			.saturating_sub((LEVEL_WIDTH + GAP) as usize / self.char.max(1.) as usize);
		line.message.contains('\n') || scope + line.message.chars().count() > room
	}
}

impl LogsPage {
	fn render_line(&self, ix: usize, cx: &mut Context<Self>) -> Option<AnyElement> {
		let (ix, place) = self.fold.place(ix);
		let row = match self.map.line(ix)? {
			Line::Entry(at) => self.render_entry(at, cx)?,
			Line::Detail { opened, line } => self.render_detail(opened, line)?,
		};
		let row = div().w_full().px(px(4.)).child(row);
		Some(place.fit(row, theme::ROW_HEIGHT).into_any_element())
	}

	fn render_entry(&self, at: usize, cx: &mut Context<Self>) -> Option<AnyElement> {
		let entry = self.rows.get(self.order.row(at, self.rows.len()))?.clone();
		let line = &entry.line;
		let seq = entry.seq;
		let opens = self.columns.overflows(&entry);
		let open = self.expanded.contains(&seq);
		let copied = entry.clone();
		let row = div()
			.id(("log-row", seq as usize))
			.group(ROW_GROUP)
			.flex()
			.items_center()
			.gap(px(GAP))
			.w_full()
			.h(theme::ROW_HEIGHT)
			.pl(px(ROW_LEAD))
			.pr(px(theme::INSET))
			.rounded(theme::RADIUS_ITEM)
			.whitespace_nowrap()
			.overflow_hidden()
			.font_family(theme::mono_font())
			.text_size(theme::TEXT_MONO)
			.hover(|row| row.bg(theme::color(theme::HOVER)))
			.child(
				div()
					.flex_none()
					.w(px(theme::CHEVRON_SLOT))
					.flex()
					.justify_center()
					.when(opens, |slot| {
						slot.child(turning_chevron(self.fold.turn(&seq, open)))
					}),
			)
			.child(
				div()
					.flex_none()
					.w(px(TIME_WIDTH))
					.text_color(theme::color(theme::TEXT_FAINT))
					.child(clock(&entry)),
			)
			.child(
				div()
					.flex_none()
					.w(px(self.columns.source))
					.flex()
					.items_center()
					// Right-aligned, so every tag ends at the same edge beside the level.
					.justify_end()
					.child(badge(line.source().label(), source_tone(line.source()))),
			)
			.child(
				div()
					.flex_none()
					.w(px(LEVEL_WIDTH))
					.text_color(theme::color(level_tone(line.level)))
					.child(line.level_label()),
			)
			.when(!line.scope.is_empty(), |row| {
				row.child(
					div()
						.flex_none()
						.text_color(theme::color(theme::TEXT_MUTED))
						.child(format!("[{}]", line.scope.join(" → "))),
				)
			})
			.child(
				div()
					.flex_1()
					.min_w_0()
					.truncate()
					.text_color(theme::color(message_tone(line.level)))
					.child(first_line(&line.message)),
			)
			.child(
				icon_button(("copy-log", seq as usize), "icons/copy.svg", false)
					.opacity(0.)
					.group_hover(ROW_GROUP, |button| button.opacity(1.))
					.tooltip(tooltip("Copy the Line"))
					.on_click(cx.listener(move |_, _, _, cx| {
						cx.stop_propagation();
						cx.write_to_clipboard(ClipboardItem::new_string(copy_text(&copied)));
					})),
			)
			.when(opens, |row| {
				row.cursor_pointer()
					.on_click(cx.listener(move |this, _, _, cx| this.toggle(seq, cx)))
			});
		Some(row.into_any_element())
	}

	/// Line `line` of an open message, under the level column.
	fn render_detail(&self, opened: usize, line: usize) -> Option<AnyElement> {
		let opened = self.map.opened.get(opened)?;
		let text = opened.lines.get(line)?.clone();
		Some(
			div()
				.h(theme::ROW_HEIGHT)
				.flex()
				.items_center()
				.pl(px(theme::INSET - theme::CHEVRON_SLOT / 2.).max(px(0.))
					+ px(self.columns.detail_indent()))
				.pr(px(theme::INSET))
				.whitespace_nowrap()
				.overflow_hidden()
				.font_family(theme::mono_font())
				.text_size(theme::TEXT_MONO)
				.text_color(theme::color(message_tone(opened.level)))
				.child(text)
				.into_any_element(),
		)
	}

	pub(super) fn render_list(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let list = uniform_list(
			"logs",
			self.fold.count(self.map.len()),
			cx.processor(|this, range: Range<usize>, _, cx| {
				range
					.filter_map(|ix| this.render_line(ix, cx))
					.collect::<Vec<_>>()
			}),
		)
		.track_scroll(&self.scroll)
		.flex_1()
		.py(px(4.));
		div()
			.flex_1()
			.min_h_0()
			.flex()
			.flex_col()
			.child(SmoothScroll::new("logs-glide", &self.scroll, list))
	}
}
