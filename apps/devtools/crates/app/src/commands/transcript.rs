//! What a command printed, kept to the last [`LIMIT`] lines so a long `logs` tail stays cheap.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

use gpui::SharedString;
use unbound_devtools_core::ubd::Stream;

const LIMIT: usize = 3_000;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LineKind {
	Out,
	Err,
	/// The app's own note, such as the command line or why it could not start.
	Note,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum RunState {
	Idle,
	Running,
	Exited(Option<i32>),
	Failed,
}

pub struct Transcript {
	pub lines: VecDeque<(LineKind, SharedString)>,
	/// Lines dropped off the front since the run began.
	pub dropped: usize,
	pub state: RunState,
	started: Option<Instant>,
	elapsed: Option<Duration>,
}

impl Default for Transcript {
	fn default() -> Self {
		Self {
			lines: VecDeque::new(),
			dropped: 0,
			state: RunState::Idle,
			started: None,
			elapsed: None,
		}
	}
}

/// Strips terminal escapes a command printed despite `NO_COLOR`.
fn plain(line: &str) -> String {
	let mut out = String::with_capacity(line.len());
	let mut chars = line.chars().peekable();
	while let Some(ch) = chars.next() {
		if ch != '\u{1b}' {
			out.push(ch);
			continue;
		}
		if chars.peek() == Some(&'[') {
			chars.next();
			for next in chars.by_ref() {
				if next.is_ascii_alphabetic() {
					break;
				}
			}
		}
	}
	out
}

impl Transcript {
	pub fn begin(&mut self, command_line: String) {
		*self = Self {
			state: RunState::Running,
			started: Some(Instant::now()),
			..Self::default()
		};
		self.push(LineKind::Note, format!("$ {command_line}"));
	}

	pub fn push(&mut self, kind: LineKind, line: String) {
		if self.lines.len() == LIMIT {
			self.lines.pop_front();
			self.dropped += 1;
		}
		self.lines.push_back((kind, plain(&line).into()));
	}

	pub fn push_output(&mut self, stream: Stream, line: String) {
		let kind = match stream {
			Stream::Stdout => LineKind::Out,
			Stream::Stderr => LineKind::Err,
		};
		self.push(kind, line);
	}

	pub fn finish(&mut self, state: RunState) {
		self.state = state;
		self.elapsed = self.started.map(|started| started.elapsed());
	}

	pub fn clear(&mut self) {
		if self.state == RunState::Running {
			self.lines.clear();
			self.dropped = 0;
		} else {
			*self = Self::default();
		}
	}

	pub fn is_running(&self) -> bool {
		self.state == RunState::Running
	}

	pub fn text(&self) -> String {
		self.lines
			.iter()
			.map(|(_, line)| line.as_ref())
			.collect::<Vec<_>>()
			.join("\n")
	}

	/// "1.2 s", once the run has ended.
	pub fn duration(&self) -> Option<String> {
		let elapsed = self.elapsed?;
		Some(if elapsed < Duration::from_secs(1) {
			format!("{} ms", elapsed.as_millis())
		} else if elapsed < Duration::from_secs(60) {
			format!("{:.1} s", elapsed.as_secs_f32())
		} else {
			format!("{}m {}s", elapsed.as_secs() / 60, elapsed.as_secs() % 60)
		})
	}
}

#[cfg(test)]
mod tests {
	use super::{LIMIT, LineKind, RunState, Transcript, plain};

	#[test]
	fn keeps_the_last_lines_and_counts_the_rest() {
		let mut transcript = Transcript::default();
		transcript.begin("ubd logs".into());
		for ix in 0..LIMIT + 5 {
			transcript.push(LineKind::Out, ix.to_string());
		}
		assert_eq!(transcript.lines.len(), LIMIT);
		assert_eq!(transcript.dropped, 6);
		assert_eq!(
			transcript.lines.back().map(|(_, line)| line.as_ref()),
			Some("3004")
		);
	}

	#[test]
	fn clearing_a_finished_run_resets_it() {
		let mut transcript = Transcript::default();
		transcript.begin("ubd status".into());
		transcript.finish(RunState::Exited(Some(0)));
		transcript.clear();
		assert_eq!(transcript.state, RunState::Idle);
		assert!(transcript.lines.is_empty());
	}

	#[test]
	fn strips_colour_escapes() {
		assert_eq!(plain("\u{1b}[32mok\u{1b}[39m done"), "ok done");
	}
}
