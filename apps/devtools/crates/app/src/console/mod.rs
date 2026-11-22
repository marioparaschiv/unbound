//! The Console page: TypeScript typed against Unbound's API, run on the device. Enter runs the
//! buffer, or adds a line inside a block or while a bracket is open; Shift+Enter always adds one. Each result stays
//! on the device as `$n`; the page gets a bounded preview and the value's shape, which types `$n`
//! for later entries.

mod assist;
mod assist_view;
mod brackets;
mod highlight;
mod keys;
mod lines;
mod output;
mod recall;
mod signature;
mod types;
mod view;

use std::collections::HashSet;
use std::rc::Rc;
use std::time::{Duration, Instant};

use gpui::{App, AppContext, Context, Entity, ScrollHandle, SharedString, Task, Window, px};
use gpui_component::input::language_config::LanguageConfig;
use gpui_component::input::{
	AutoClosingPair, EditorState, InputEvent, RangeDecoration, RangeDecorationCollection, RopeExt,
	SyntaxContext, set_language_config,
};
use serde_json::Value;
use unbound_devtools_core::Devtools;
use unbound_devtools_repl::{checker, device, transpile};

use self::assist::Assist;
use self::highlight::Highlighted;
use self::output::{Content, Output};
use self::recall::Recall;
use crate::accordion::Accordion;
use crate::app::on_runtime;
use crate::mcp_menu::McpButton;
use crate::theme;

const CHECK_DEBOUNCE: Duration = Duration::from_millis(200);
/// Older entries drop off, so the page never lays out an unbounded list.
const MAX_ENTRIES: usize = 200;
const LANGUAGE: &str = "typescript";

/// Binds the Console editor's keys and closes backticks as it closes quotes.
pub fn init(cx: &mut App) {
	keys::bind_keys(cx);
	let mut config = LanguageConfig::default();
	config.auto_closing_pairs.get_or_insert_default().push(
		AutoClosingPair::new("`", "`").not_in([SyntaxContext::String, SyntaxContext::Comment]),
	);
	set_language_config(LANGUAGE, config, cx);
}

pub enum Outcome {
	Running,
	Value { output: Output, truncated: bool },
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
	/// The folded values opened in place, by fold id.
	open: HashSet<u64>,
	motion: Accordion<u64>,
	next_fold: u64,
	/// Whether the device has the helper, so requests can call it by name.
	helper_installed: bool,
	/// Entries that ran, as typed, for the checker's history.
	history: String,
	/// `$n` declarations.
	results: String,
	recall: Recall,
	/// The frames around the bracket at the caret and its partner.
	bracket_frames: RangeDecorationCollection,
	framed: Option<(usize, usize)>,
	types: TypesState,
	scroll: ScrollHandle,
	/// A fold opened while the output sat at its bottom, so the output keeps to the bottom as it grows.
	follow_bottom: bool,
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

/// The output of entry `n`, while it shows a value.
fn output_of(entries: &mut [Entry], n: u32) -> Option<&mut Output> {
	let entry = entries.iter_mut().find(|entry| entry.n == n)?;
	match &mut entry.outcome {
		Outcome::Value { output, .. } => Some(output),
		_ => None,
	}
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
				.language(LANGUAGE)
				.line_number(true)
				.submit_on_enter(true)
				.placeholder("unbound.flux.getStore('User').getCurrentUser()")
		});
		let assist = cx.new(|cx| Assist::new(editor.clone(), cx));
		let bracket_frames = editor.update(cx, |editor, cx| {
			editor.create_range_decorations_collection(Vec::new(), cx)
		});
		cx.observe(&editor, |this, _, cx| this.frame_brackets(cx))
			.detach();
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
			open: HashSet::new(),
			motion: Accordion::default(),
			next_fold: 0,
			helper_installed: false,
			history: String::new(),
			results: String::new(),
			recall: Recall::default(),
			bracket_frames,
			framed: None,
			types: TypesState::Loading,
			scroll: ScrollHandle::new(),
			follow_bottom: false,
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
				let declaration = device::declaration(n, &preview.ty);
				let truncated = preview.truncated;
				let mut output = Output::new(preview, &[], &mut self.next_fold);
				let unread = output.take_unread();
				entry.outcome = Outcome::Value { output, truncated };
				self.expand(n, unread, cx);
				self.history.push_str(code);
				self.history.push_str("\n;\n");
				self.results.push_str(&declaration);
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

	/// Frames the bracket touching the caret and its partner, when the caret moved onto another.
	fn frame_brackets(&mut self, cx: &mut Context<Self>) {
		let editor = self.editor.read(cx);
		let framed = editor
			.selected_range()
			.is_empty()
			.then(|| brackets::matching(&editor.value(), editor.cursor()))
			.flatten();
		if framed == self.framed {
			return;
		}
		self.framed = framed;
		let color: gpui::Hsla = theme::alpha(theme::TEXT_MUTED, 0.7).into();
		let frames = framed.map_or_else(Vec::new, |(open, close)| {
			[open, close]
				.into_iter()
				.map(|at| RangeDecoration::new(at..at + 1).with_color(color))
				.collect()
		});
		self.bracket_frames.set(frames, cx);
	}

	/// Reads the previews of `folds` in `$n` in one round trip. An open fold that arrives grows in,
	/// and its own folds are read next, so a click one level down finds them ready.
	fn expand(&mut self, n: u32, folds: Vec<(u64, Rc<[Value]>)>, cx: &mut Context<Self>) {
		if folds.is_empty() {
			return;
		}
		let paths: Vec<&[Value]> = folds.iter().map(|(_, path)| &path[..]).collect();
		let code = device::expand_request(n, &paths);
		let devtools = self.devtools.clone();
		cx.spawn(async move |this, cx| {
			let reply = eval(&devtools, code).await;
			this.update(cx, |this, cx| this.expanded(n, folds, reply, cx))
				.ok();
		})
		.detach();
	}

	fn expanded(
		&mut self,
		n: u32,
		folds: Vec<(u64, Rc<[Value]>)>,
		reply: Result<String, String>,
		cx: &mut Context<Self>,
	) {
		let answers = reply.and_then(|reply| device::parse_expansions(&reply));
		let reduce = cx.reduce_motion();
		let mut next_fold = self.next_fold;
		let mut grown = Vec::new();
		let mut unread = Vec::new();
		let open = &self.open;
		let Some(output) = output_of(&mut self.entries, n) else {
			return;
		};
		for (ix, (id, path)) in folds.into_iter().enumerate() {
			let Some(fold) = output.find(id) else {
				continue;
			};
			fold.content = match &answers {
				Err(error) => Content::Failed(error.clone().into()),
				Ok(items) => match items.get(ix).cloned().flatten() {
					Some(Ok(preview)) => {
						Content::Ready(Output::new(preview, &path, &mut next_fold))
					}
					Some(Err(error)) => Content::Failed(error.into()),
					// Past the answer's budget: read again when opened.
					None => Content::Unread,
				},
			};
			if open.contains(&id) {
				grown.push(id);
				if let Content::Ready(inner) = &mut fold.content {
					unread.extend(inner.take_unread());
				}
			}
		}
		self.next_fold = next_fold;
		self.follow_bottom |= !grown.is_empty() && self.at_bottom();
		for id in grown {
			self.motion.toggle(id, true, reduce);
		}
		self.expand(n, unread, cx);
		cx.notify();
	}

	/// Opens or closes fold `id` in entry `n`, reading its preview first when it has none yet.
	pub(super) fn toggle_fold(&mut self, n: u32, id: u64, cx: &mut Context<Self>) {
		let opening = !self.open.remove(&id);
		if opening {
			self.open.insert(id);
		}
		let reduce = cx.reduce_motion();
		let Some(fold) = output_of(&mut self.entries, n).and_then(|output| output.find(id)) else {
			return;
		};
		let mut fetch = Vec::new();
		match &mut fold.content {
			Content::Unread | Content::Failed(_) if opening => {
				fold.content = Content::Loading;
				fetch.push((id, fold.path.clone()));
			}
			Content::Ready(inner) if opening => fetch = inner.take_unread(),
			_ => {}
		}
		// A fold still loading grows in once its preview arrives.
		if !matches!(fold.content, Content::Loading) {
			self.motion.toggle(id, opening, reduce);
			self.follow_bottom |= opening && self.at_bottom();
		}
		self.expand(n, fetch, cx);
		cx.notify();
	}

	/// Whether the output shows its last line, or fits without scrolling.
	fn at_bottom(&self) -> bool {
		-self.scroll.offset().y >= self.scroll.max_offset().y - px(2.)
	}

	pub fn clear(&mut self, cx: &mut Context<Self>) {
		self.entries.clear();
		self.open.clear();
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
