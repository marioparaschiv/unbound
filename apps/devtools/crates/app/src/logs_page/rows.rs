//! The Logs page's rows: the time, a coloured source tag, the level, the scope, then the message's
//! first line. Only the rows on screen are drawn.

use std::ops::Range;

use gpui::{AnyElement, ClipboardItem, Context, div, prelude::*, px, uniform_list};
use unbound_devtools_core::{LogEntry, LogSource};

use super::LogsPage;
use crate::smooth_scroll::SmoothScroll;
use crate::theme::{self, Token};
use crate::widgets::badge;

const TIME_WIDTH: f32 = 92.;
const SOURCE_WIDTH: f32 = 96.;
const LEVEL_WIDTH: f32 = 40.;

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

/// The whole line, as clicking it copies it.
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

impl LogsPage {
	fn render_row(&self, ix: usize, cx: &mut Context<Self>) -> Option<AnyElement> {
		let entry = self.rows.get(ix)?.clone();
		let line = &entry.line;
		let message_tone = match line.level {
			3 => theme::ERROR,
			2 => theme::WARNING,
			_ => theme::TEXT,
		};
		let row = div()
			.id(("log-row", entry.seq as usize))
			.flex()
			.items_center()
			.gap(px(8.))
			.w_full()
			.h(theme::ROW_HEIGHT)
			.px(px(theme::INSET))
			.rounded(theme::RADIUS_ITEM)
			.whitespace_nowrap()
			.overflow_hidden()
			.font_family(theme::mono_font())
			.text_size(theme::TEXT_MONO)
			.cursor_pointer()
			.hover(|row| row.bg(theme::color(theme::HOVER)))
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
					.w(px(SOURCE_WIDTH))
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
					.text_color(theme::color(message_tone))
					.child(first_line(&line.message)),
			)
			.on_click(cx.listener(move |_, _, _, cx| {
				cx.write_to_clipboard(ClipboardItem::new_string(copy_text(&entry)));
			}));
		Some(div().w_full().px(px(4.)).child(row).into_any_element())
	}

	pub(super) fn render_list(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let list = uniform_list(
			"logs",
			self.rows.len(),
			cx.processor(|this, range: Range<usize>, _, cx| {
				range
					.filter_map(|ix| this.render_row(ix, cx))
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
