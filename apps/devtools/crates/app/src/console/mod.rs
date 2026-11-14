//! The Console page: TypeScript typed against Unbound's API, run on the device. Enter runs the
//! buffer and Shift+Enter adds a line. Each result stays on the device as `$n`; the page gets a
//! bounded preview and the value's shape, which types `$n` for later entries.

mod assist;
mod assist_view;
mod highlight;
mod recall;
mod types;
mod view;

use std::rc::Rc;
use std::time::{Duration, Instant};

use gpui::{AppContext, Context, Entity, ScrollHandle, SharedString, Task, Window};
use gpui_component::input::{EditorState, InputEvent, RopeExt};
use unbound_devtools_core::Devtools;
use unbound_devtools_repl::{checker, device, transpile};

use self::assist::Assist;
use self::highlight::Highlighted;
use self::recall::Recall;
use crate::app::on_runtime;
use crate::mcp_menu::McpButton;

const CHECK_DEBOUNCE: Duration = Duration::from_millis(200);
/// Older entries drop off, so the page never lays out an unbounded list.
const MAX_ENTRIES: usize = 200;

pub enum Outcome {
	Running,
	Value { text: Highlighted, truncated: bool },
	Error(SharedString),
}

pub struct Entry {
	pub n: u32,
	pub code: Highlighted,
	pub outcome: Outcome,
	pub elapsed: Duration,
	/// The answer's size on the wire.
	pub bytes: usize,
}

/// Whether the checker has started.
pub enum TypesState {
	Loading,
	Ready,
	Failed(SharedString),
}

pub struct Console {
	devtools: Devtools,
	editor: Entity<EditorState>,
	/// The completion menu and hover card over the editor.
	assist: Entity<Assist>,
	entries: Vec<Entry>,
	next: u32,
	/// Whether the device has the helper, so requests can call it by name.
	helper_installed: bool,
	/// Entries that ran, as typed, for the checker's history.
	history: String,
	/// `$n` declarations.
	results: String,
	recall: Recall,
	types: TypesState,
	scroll: ScrollHandle,
	mcp: Entity<McpButton>,
	running: Option<Task<()>>,
	checking: Option<Task<()>>,
	_start: Task<()>,
}

async fn eval(devtools: &Devtools, code: String) -> Result<String, String> {
	let device = devtools.clone();
	on_runtime(devtools, async move {
		device
			.eval(&code)
			.await
			.map_err(|error| format!("{error:#}"))
	})
	.await
	.unwrap_or_else(|| Err("The eval was cancelled.".to_owned()))
}

/// Runs entry `n`, sending the helper only when the device lacks it.
async fn send(devtools: Devtools, n: u32, js: String, install: bool) -> Result<String, String> {
	match eval(&devtools, device::request(n, &js, install)).await {
		Err(error) if !install && device::is_missing_helper(&error) => {
			eval(&devtools, device::request(n, &js, true)).await
		}
		outcome => outcome,
	}
}

impl Console {
	pub fn new(
		devtools: Devtools,
		mcp: Entity<McpButton>,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> Self {
		let editor = cx.new(|cx| {
			EditorState::new(window, cx)
				.language("typescript")
				.line_number(true)
				.submit_on_enter(true)
				.placeholder("unbound.flux.getStore('User').getCurrentUser()")
		});
		let assist = cx.new(|cx| Assist::new(editor.clone(), cx));
		let types = Rc::new(types::Types {
			assist: assist.downgrade(),
		});
		editor.update(cx, |editor, _| {
			editor.lsp_mut().completion_provider = Some(types.clone());
			editor.lsp_mut().hover_provider = Some(types);
		});
		cx.subscribe_in(
			&editor,
			window,
			|this, _, event: &InputEvent, window, cx| match event {
				InputEvent::PressEnter { shift: false, .. } => this.run(window, cx),
				InputEvent::Change => this.schedule_check(cx),
				_ => {}
			},
		)
		.detach();
		// Starts tsrs now, so the first completion doesn't wait for it.
		let start = cx.spawn(async move |this, cx| {
			let started = cx
				.background_spawn(async { checker::shared().map(|_| ()) })
				.await;
			this.update(cx, |this, cx| {
				this.types = match started {
					Ok(()) => TypesState::Ready,
					Err(error) => TypesState::Failed(error.into()),
				};
				cx.notify();
			})
			.ok();
		});

		Self {
			devtools,
			editor,
			assist,
			entries: Vec::new(),
			next: 1,
			helper_installed: false,
			history: String::new(),
			results: String::new(),
			recall: Recall::default(),
			types: TypesState::Loading,
			scroll: ScrollHandle::new(),
			mcp,
			running: None,
			checking: None,
			_start: start,
		}
	}

	pub fn focus(&self, window: &mut Window, cx: &mut Context<Self>) {
		self.editor
			.update(cx, |editor, cx| editor.focus(window, cx));
	}

	fn run(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		let code = self.editor.read(cx).value().trim().to_owned();
		if code.is_empty() || self.running.is_some() {
			return;
		}
		let n = self.next;
		self.next += 1;
		self.recall.push(&code);
		self.editor
			.update(cx, |editor, cx| editor.set_value("", window, cx));
		if self.entries.len() >= MAX_ENTRIES {
			self.entries.remove(0);
		}
		self.entries.push(Entry {
			n,
			code: Highlighted::new(code.clone()),
			outcome: Outcome::Running,
			elapsed: Duration::ZERO,
			bytes: 0,
		});
		self.scroll.scroll_to_bottom();
		cx.notify();
		let js = match transpile(&code) {
			Ok(js) => js,
			Err(error) => {
				self.finish(n, &code, Err(error), Duration::ZERO, cx);
				return;
			}
		};
		let devtools = self.devtools.clone();
		let install = !self.helper_installed;
		let started = Instant::now();
		self.running = Some(cx.spawn(async move |this, cx| {
			let outcome = send(devtools, n, js, install).await;
			this.update(cx, |this, cx| {
				this.running = None;
				this.finish(n, &code, outcome, started.elapsed(), cx);
			})
			.ok();
		}));
	}

	fn finish(
		&mut self,
		n: u32,
		code: &str,
		outcome: Result<String, String>,
		elapsed: Duration,
		cx: &mut Context<Self>,
	) {
		let Some(entry) = self.entries.iter_mut().find(|entry| entry.n == n) else {
			return;
		};
		entry.elapsed = elapsed;
		entry.bytes = match &outcome {
			Ok(text) | Err(text) => text.len(),
		};
		// Any answer, even what the entry threw, came through the helper.
		self.helper_installed |= outcome.is_ok();
		match outcome.and_then(|reply| device::parse(&reply)) {
			Ok(preview) => {
				entry.outcome = Outcome::Value {
					text: Highlighted::new(preview.text),
					truncated: preview.truncated,
				};
				self.history.push_str(code);
				self.history.push_str("\n;\n");
				self.results.push_str(&device::declaration(n, &preview.ty));
				let (history, results) = (self.history.clone(), self.results.clone());
				cx.background_spawn(async move {
					if let Ok(checker) = checker::shared() {
						checker.set_history(&history);
						checker.set_results(&results);
					}
				})
				.detach();
			}
			Err(error) => {
				entry.outcome = Outcome::Error(error.into());
			}
		}
		self.scroll.scroll_to_bottom();
		cx.notify();
	}

	/// ↑ or ↓: moves the completion menu's selection when it shows, else steps through earlier
	/// entries from the editor's first or last line. False leaves the key to the editor.
	fn step(&mut self, back: bool, window: &mut Window, cx: &mut Context<Self>) -> bool {
		let delta = if back { -1 } else { 1 };
		if self
			.assist
			.update(cx, |assist, cx| assist.move_selection(delta, cx))
		{
			return true;
		}
		let editor = self.editor.read(cx);
		let text = editor.text();
		let row = text.offset_to_point(editor.cursor()).row;
		let at_edge = if back {
			row == 0
		} else {
			row + 1 >= text.lines_len()
		};
		if !at_edge {
			return false;
		}
		let current = editor.value().to_string();
		let code = if back {
			self.recall.back(&current)
		} else {
			self.recall.forward()
		};
		let Some(code) = code else {
			return false;
		};
		self.editor.update(cx, |editor, cx| {
			editor.set_value(code, window, cx);
			let end = editor.text().len();
			editor.set_selected_range(end..end, cx);
		});

		true
	}

	pub fn clear(&mut self, cx: &mut Context<Self>) {
		self.entries.clear();
		cx.notify();
	}

	/// Marks the buffer's type errors once typing pauses.
	fn schedule_check(&mut self, cx: &mut Context<Self>) {
		let editor = self.editor.clone();
		self.checking = Some(cx.spawn(async move |_, cx| {
			cx.background_executor().timer(CHECK_DEBOUNCE).await;
			let buffer = editor.read_with(cx, |editor, _| editor.value().to_string());
			let checked = cx
				.background_spawn(async move {
					checker::shared()
						.map_err(anyhow::Error::msg)?
						.diagnostics(&buffer)
						.map(|items| (buffer, items))
				})
				.await;
			let Ok((buffer, items)) = checked else {
				return;
			};
			editor.update(cx, |editor, cx| {
				// A newer edit gets its own check.
				if editor.value().as_ref() != buffer {
					return;
				}
				let text = editor.text().clone();
				if let Some(diagnostics) = editor.diagnostics_mut() {
					diagnostics.reset(&text);
					diagnostics.extend(items);
				}
				cx.notify();
			});
		}));
	}
}
