//! What a command printed, kept to the last [`LIMIT`] lines so a long `logs` tail stays cheap.

use std::collections::VecDeque;
use std::time::{Duration, Instant};

use gpui::SharedString;
use serde_json::Value;
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
	/// Whether the run printed JSON (`--json`), shown pretty-printed.
	json: bool,
	started: Option<Instant>,
	elapsed: Option<Duration>,
}

impl Default for Transcript {
	fn default() -> Self {
		Self {
			lines: VecDeque::new(),
			dropped: 0,
			state: RunState::Idle,
			json: false,
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

/// An `eval-result`'s console output, then its value or error, as `ubd` prints it without `--json`.
fn eval_lines(value: &Value) -> Option<(LineKind, Vec<String>)> {
	let ok = value.get("ok")?.as_bool()?;
	let result = value.get(if ok { "value" } else { "error" })?.as_str()?;
	let logs = value
		.get("logs")
		.and_then(Value::as_array)
		.into_iter()
		.flatten();
	let lines = logs
		.filter_map(|log| log.get("message").and_then(Value::as_str))
		.chain(std::iter::once(result))
		.flat_map(str::lines)
		.map(str::to_owned)
		.collect();
	Some((if ok { LineKind::Out } else { LineKind::Err }, lines))
}

/// A `--json` stdout line as the transcript shows it: a failure's text, an eval's result, or the
/// data pretty-printed.
fn json_lines(line: &str) -> Option<(LineKind, Vec<String>)> {
	let value: Value = serde_json::from_str(line).ok()?;
	let failed = value.get("ok") == Some(&Value::Bool(false))
		&& value.get("error").is_some_and(Value::is_object);
	if failed && let Some(text) = value.get("text").and_then(Value::as_str) {
		return Some((LineKind::Err, text.lines().map(str::to_owned).collect()));
	}
	if value.get("type").and_then(Value::as_str) == Some("eval-result") {
		return eval_lines(&value);
	}
	let pretty = serde_json::to_string_pretty(&value).ok()?;
	Some((LineKind::Out, pretty.lines().map(str::to_owned).collect()))
}

impl Transcript {
	pub fn begin(&mut self, command_line: String, json: bool) {
		*self = Self {
			state: RunState::Running,
			json,
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
		if self.json
			&& stream == Stream::Stdout
			&& let Some((kind, lines)) = json_lines(&line)
		{
			for line in lines {
				self.push(kind, line);
			}
			return;
		}
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
	use unbound_devtools_core::ubd::Stream;

	#[test]
	fn keeps_the_last_lines_and_counts_the_rest() {
		let mut transcript = Transcript::default();
		transcript.begin("ubd logs".into(), false);
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
		transcript.begin("ubd status".into(), false);
		transcript.finish(RunState::Exited(Some(0)));
		transcript.clear();
		assert_eq!(transcript.state, RunState::Idle);
		assert!(transcript.lines.is_empty());
	}

	#[test]
	fn shows_json_output_readably() {
		let mut transcript = Transcript::default();
		transcript.begin("ubd status --json".into(), true);
		transcript.push_output(Stream::Stdout, r#"{"count":1}"#.into());
		transcript.push_output(
			Stream::Stdout,
			r#"{"ok":false,"text":"No device.","error":{"code":"no-device","message":"No device."}}"#.into(),
		);
		transcript.push_output(
			Stream::Stdout,
			r#"{"type":"eval-result","id":"1","ok":true,"value":"a\nb","logs":[{"type":"log","level":1,"message":"hi"}]}"#.into(),
		);
		let lines: Vec<_> = transcript
			.lines
			.iter()
			.skip(1)
			.map(|(kind, line)| (*kind, line.to_string()))
			.collect();
		assert_eq!(
			lines,
			[
				(LineKind::Out, "{".into()),
				(LineKind::Out, "  \"count\": 1".into()),
				(LineKind::Out, "}".into()),
				(LineKind::Err, "No device.".into()),
				(LineKind::Out, "hi".into()),
				(LineKind::Out, "a".into()),
				(LineKind::Out, "b".into()),
			]
		);
	}

	#[test]
	fn strips_colour_escapes() {
		assert_eq!(plain("\u{1b}[32mok\u{1b}[39m done"), "ok done");
	}
}
