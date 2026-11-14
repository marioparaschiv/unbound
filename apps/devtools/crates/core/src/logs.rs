//! The device's live log lines (`LogMessage` in the protocol), kept as they arrive over the
//! debugger connection so the GUI can list and filter them. Only the newest [`LOG_CAPACITY`] stay;
//! the device's own files hold the full history.

use std::collections::VecDeque;
use std::sync::Arc;
use std::time::SystemTime;

use serde::{Deserialize, Serialize};

use crate::session::{Devtools, Inner};

/// How many lines the GUI keeps; older ones drop off the front.
pub const LOG_CAPACITY: usize = 10_000;

/// Who wrote a line (`LogSource` in the protocol).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum LogSource {
	Unbound,
	Js,
	ReactNative,
	Native,
}

impl LogSource {
	pub fn label(self) -> &'static str {
		match self {
			LogSource::Unbound => "Unbound",
			LogSource::Js => "JS",
			LogSource::ReactNative => "React Native",
			LogSource::Native => "Native",
		}
	}
}

/// One `log` frame as the device sent it. `source`, `scope` and `at` are missing from a client
/// that predates them.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct LogLine {
	/// 1 = debug, info or log; 2 = warn; 3 = error.
	pub level: u8,
	pub message: String,
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub source: Option<LogSource>,
	#[serde(default, skip_serializing_if = "Vec::is_empty")]
	pub scope: Vec<String>,
	/// Milliseconds since the epoch, when the device wrote it.
	#[serde(default, skip_serializing_if = "Option::is_none")]
	pub at: Option<f64>,
}

impl LogLine {
	/// The line's source; one without came through `nativeLoggingHook`, which carries console output.
	pub fn source(&self) -> LogSource {
		self.source.unwrap_or(LogSource::Js)
	}

	pub fn level_label(&self) -> &'static str {
		match self.level {
			3 => "ERROR",
			2 => "WARN",
			_ => "LOG",
		}
	}
}

/// A line and when it arrived, numbered in arrival order.
#[derive(Clone, Debug)]
pub struct LogEntry {
	pub seq: u64,
	pub received: SystemTime,
	pub line: LogLine,
}

impl LogEntry {
	/// When the device wrote the line, or when it arrived for a client that sends no time.
	pub fn time(&self) -> SystemTime {
		self.line
			.at
			.filter(|at| at.is_finite() && *at >= 0.)
			.map_or(self.received, |at| {
				SystemTime::UNIX_EPOCH + std::time::Duration::from_secs_f64(at / 1000.)
			})
	}
}

/// The Logs page's segments.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum LogView {
	#[default]
	All,
	/// Discord's JS console and Unbound.
	Js,
	ReactNative,
	Native,
}

impl LogView {
	pub const ALL: [LogView; 4] = [
		LogView::All,
		LogView::Js,
		LogView::ReactNative,
		LogView::Native,
	];

	pub fn label(self) -> &'static str {
		match self {
			LogView::All => "All",
			LogView::Js => "JS",
			LogView::ReactNative => "React Native",
			LogView::Native => "Native",
		}
	}
}

/// Which lines the Logs page shows.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct LogFilter {
	pub view: LogView,
	/// Only Unbound's own lines, within the view.
	pub unbound_only: bool,
}

impl LogFilter {
	pub fn matches(&self, line: &LogLine) -> bool {
		let source = line.source();

		if self.unbound_only && source != LogSource::Unbound {
			return false;
		}

		match self.view {
			LogView::All => true,
			LogView::Js => matches!(source, LogSource::Js | LogSource::Unbound),
			LogView::ReactNative => source == LogSource::ReactNative,
			LogView::Native => source == LogSource::Native,
		}
	}
}

/// The kept lines and the number the next one gets.
#[derive(Default)]
pub(crate) struct LogBuffer {
	entries: VecDeque<Arc<LogEntry>>,
	next_seq: u64,
}

impl LogBuffer {
	fn push(&mut self, line: LogLine) -> u64 {
		self.next_seq += 1;

		if self.entries.len() == LOG_CAPACITY {
			self.entries.pop_front();
		}

		self.entries.push_back(Arc::new(LogEntry {
			seq: self.next_seq,
			received: SystemTime::now(),
			line,
		}));

		self.next_seq
	}

	fn after(&self, seq: u64) -> Vec<Arc<LogEntry>> {
		let start = self.entries.partition_point(|entry| entry.seq <= seq);

		self.entries.range(start..).cloned().collect()
	}
}

impl Inner {
	/// Keeps a line the device sent and wakes [`Devtools::log_changes`] watchers.
	pub(crate) fn receive_log(&self, line: LogLine) {
		let seq = self.logs.lock().push(line);

		self.log_changes.send_replace(seq);
	}
}

impl Devtools {
	/// The newest line's number, bumped on every line and on [`Self::clear_logs`]. Separate from
	/// [`Self::changes`], so a busy log does not redraw every page.
	pub fn log_changes(&self) -> tokio::sync::watch::Receiver<u64> {
		self.inner.log_changes.subscribe()
	}

	/// The kept lines numbered after `seq`, oldest first; `0` gives them all.
	pub fn logs_after(&self, seq: u64) -> Vec<Arc<LogEntry>> {
		self.inner.logs.lock().after(seq)
	}

	/// Drops every kept line. Numbering carries on, so a reader's last number stays valid.
	pub fn clear_logs(&self) {
		let seq = {
			let mut logs = self.inner.logs.lock();
			logs.entries.clear();
			logs.next_seq
		};

		self.inner.log_changes.send_replace(seq);
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn line(source: Option<LogSource>) -> LogLine {
		LogLine {
			level: 1,
			message: "x".into(),
			source,
			scope: Vec::new(),
			at: None,
		}
	}

	fn shown(filter: LogFilter) -> Vec<Option<LogSource>> {
		[
			None,
			Some(LogSource::Unbound),
			Some(LogSource::Js),
			Some(LogSource::ReactNative),
			Some(LogSource::Native),
		]
		.into_iter()
		.filter(|source| filter.matches(&line(*source)))
		.collect()
	}

	#[test]
	fn filters_by_view_with_js_holding_unbound() {
		let view = |view| LogFilter {
			view,
			unbound_only: false,
		};

		assert_eq!(shown(view(LogView::All)).len(), 5);
		assert_eq!(
			shown(view(LogView::Js)),
			[None, Some(LogSource::Unbound), Some(LogSource::Js)]
		);
		assert_eq!(
			shown(view(LogView::ReactNative)),
			[Some(LogSource::ReactNative)]
		);
		assert_eq!(shown(view(LogView::Native)), [Some(LogSource::Native)]);
	}

	#[test]
	fn unbound_only_keeps_unbound_lines_within_the_view() {
		let unbound = |view| LogFilter {
			view,
			unbound_only: true,
		};

		assert_eq!(shown(unbound(LogView::All)), [Some(LogSource::Unbound)]);
		assert_eq!(shown(unbound(LogView::Js)), [Some(LogSource::Unbound)]);
		assert!(shown(unbound(LogView::Native)).is_empty());
	}

	#[test]
	fn reads_lines_with_and_without_their_source() {
		let old: LogLine =
			serde_json::from_str(r#"{"type":"log","level":2,"message":"hi"}"#).unwrap();
		assert_eq!(old.source(), LogSource::Js);
		assert!(old.scope.is_empty());

		let new: LogLine = serde_json::from_str(
			r#"{"type":"log","level":1,"message":"m","source":"react-native","scope":["A","B"],"at":1700000000000}"#,
		)
		.unwrap();
		assert_eq!(new.source(), LogSource::ReactNative);
		assert_eq!(new.scope, ["A", "B"]);
		assert_eq!(new.at, Some(1_700_000_000_000.));
	}

	#[test]
	fn keeps_the_newest_lines_and_reads_after_a_number() {
		let mut buffer = LogBuffer::default();

		for _ in 0..LOG_CAPACITY + 5 {
			buffer.push(line(None));
		}

		assert_eq!(buffer.entries.len(), LOG_CAPACITY);
		assert_eq!(buffer.after(0).first().map(|entry| entry.seq), Some(6));
		let last = (LOG_CAPACITY + 5) as u64;
		assert_eq!(buffer.after(last - 2).len(), 2);
		assert!(buffer.after(last).is_empty());
	}
}
