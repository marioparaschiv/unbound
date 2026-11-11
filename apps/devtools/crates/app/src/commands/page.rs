//! One `ubd` command as a page: its options down the left, what it prints on the right.

use std::time::Duration;

use gpui::{
	App, ClipboardItem, Context, FocusHandle, Focusable, FontWeight, KeyBinding, ScrollHandle,
	Task, Window, actions, div, prelude::*, px,
};

use gpui_component::input::{Input as TextField, InputEvent};
use gpui_component::scroll::ScrollableElement;
use gpui_component::switch::Switch;
use tokio::sync::oneshot;
use unbound_devtools_core::ubd::{self, CommandSpec, FieldValue, Launcher, RunEvent};

use super::form::{self, BRIDGE_PORT_FIELD, Control, Input};
use super::nav;
use super::transcript::{LineKind, RunState, Transcript};
use crate::settings;
use crate::smooth_scroll::SmoothScroll;
use crate::theme;
use crate::widgets::{
	Raised, eyebrow, footer_bar, ghost_button, kbd, page_header, page_header_end, prose,
	raised_button, segmented, tooltip,
};

actions!(command_page, [RunCommand, StopCommand]);

const CONTEXT: &str = "CommandPage";
/// Output arrives in bursts; one repaint per frame is plenty.
const COALESCE: Duration = Duration::from_millis(16);
/// The form column; wide enough for a path or a line of JavaScript.
const FORM_WIDTH: f32 = 380.;

pub fn bind_keys(cx: &mut App) {
	let run = if cfg!(target_os = "macos") {
		"cmd-enter"
	} else {
		"ctrl-enter"
	};
	cx.bind_keys([
		KeyBinding::new(run, RunCommand, Some(CONTEXT)),
		KeyBinding::new("ctrl-c", StopCommand, Some(CONTEXT)),
	]);
}

pub struct CommandPage {
	spec: CommandSpec,
	runtime: tokio::runtime::Handle,
	controls: Vec<Control>,
	error: Option<String>,
	transcript: Transcript,
	stop: Option<oneshot::Sender<()>>,
	scroll: ScrollHandle,
	form_scroll: ScrollHandle,
	focus: FocusHandle,
	_run: Option<Task<()>>,
	_subscriptions: Vec<gpui::Subscription>,
}

impl CommandPage {
	pub fn new(
		spec: CommandSpec,
		runtime: tokio::runtime::Handle,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> Self {
		let controls = form::build(&spec, window, cx);
		let subscriptions = controls
			.iter()
			.filter_map(|control| match &control.input {
				Input::Text(state) => Some(cx.subscribe_in(
					state,
					window,
					|this, _, event: &InputEvent, window, cx| match event {
						InputEvent::PressEnter { .. } => this.run(window, cx),
						InputEvent::Change if this.error.take().is_some() => cx.notify(),
						_ => {}
					},
				)),
				_ => None,
			})
			.collect();
		Self {
			spec,
			runtime,
			controls,
			error: None,
			transcript: Transcript::default(),
			stop: None,
			scroll: ScrollHandle::new(),
			form_scroll: ScrollHandle::new(),
			focus: cx.focus_handle(),
			_run: None,
			_subscriptions: subscriptions,
		}
	}

	pub fn is_running(&self) -> bool {
		self.transcript.is_running()
	}

	fn launch(&self, cx: &App) -> Result<(Launcher, Vec<String>), String> {
		let settings = settings::get(cx);
		let mut values = form::values(&self.controls, cx);
		let takes_port = self
			.spec
			.fields
			.iter()
			.any(|field| field.name == BRIDGE_PORT_FIELD && !form::is_visible(field));
		if takes_port {
			values.insert(
				BRIDGE_PORT_FIELD.to_owned(),
				FieldValue::Text(settings.bridge_port.to_string()),
			);
		}
		let args = ubd::arguments(&self.spec, &values).map_err(|error| error.to_string())?;
		let launcher = Launcher::resolve(&settings.cli_command)
			.ok_or_else(|| "Set how to run ubd in Settings.".to_owned())?;
		Ok((
			launcher,
			self.spec.path.iter().cloned().chain(args).collect(),
		))
	}

	/// `ubd hook [flags] <className> <method>`, for before the form is valid.
	fn usage(&self) -> String {
		let flags = self
			.spec
			.fields
			.iter()
			.any(|field| !field.positional && form::is_visible(field));
		std::iter::once("ubd".to_owned())
			.chain(self.spec.path.iter().cloned())
			.chain(flags.then(|| "[flags]".to_owned()))
			.chain(self.spec.positionals.iter().map(|name| format!("<{name}>")))
			.collect::<Vec<_>>()
			.join(" ")
	}

	/// The line this form would run, for the header and the clipboard.
	fn command_line(&self, cx: &App) -> Option<String> {
		self.launch(cx)
			.ok()
			.map(|(launcher, argv)| launcher.display(&argv))
	}

	fn run(&mut self, window: &mut Window, cx: &mut Context<Self>) {
		if self.transcript.is_running() {
			return;
		}
		let (launcher, argv) = match self.launch(cx) {
			Ok(launch) => launch,
			Err(error) => {
				self.error = Some(error);
				cx.notify();
				return;
			}
		};
		self.error = None;
		self.transcript.begin(launcher.display(&argv));
		let cwd = settings::get(cx).working_dir();
		let run = ubd::spawn(&self.runtime, &launcher, &argv, cwd);
		self.stop = Some(run.stop);
		let mut events = run.events;
		self._run = Some(cx.spawn(async move |this, cx| {
			while let Some(first) = events.recv().await {
				let mut batch = vec![first];
				while let Ok(event) = events.try_recv() {
					batch.push(event);
				}
				let updated = this.update(cx, |this, cx| {
					let follow = this.at_bottom();
					for event in batch {
						this.apply(event);
					}
					if follow {
						this.scroll.scroll_to_bottom();
					}
					cx.notify();
				});
				if updated.is_err() {
					return;
				}
				cx.background_executor().timer(COALESCE).await;
			}
		}));
		window.focus(&self.focus, cx);
		cx.notify();
	}

	fn at_bottom(&self) -> bool {
		let max = self.scroll.max_offset().y;
		-self.scroll.offset().y >= max - px(24.)
	}

	fn apply(&mut self, event: RunEvent) {
		match event {
			RunEvent::Line(stream, line) => self.transcript.push_output(stream, line),
			RunEvent::Exited(code) => {
				self.stop = None;
				self.transcript.finish(RunState::Exited(code));
			}
			RunEvent::Failed(error) => {
				self.stop = None;
				let program = self.spec.path.join(" ");
				self.transcript.push(
					LineKind::Err,
					format!(
						"Failed to start ubd {program}: {error}. Check how to run ubd in Settings."
					),
				);
				self.transcript.finish(RunState::Failed);
			}
		}
	}

	fn stop(&mut self, cx: &mut Context<Self>) {
		if let Some(stop) = self.stop.take() {
			let _ = stop.send(());
			self.transcript.push(LineKind::Note, "Stopping".into());
			cx.notify();
		}
	}

	fn on_run(&mut self, _: &RunCommand, window: &mut Window, cx: &mut Context<Self>) {
		self.run(window, cx);
	}

	fn on_stop(&mut self, _: &StopCommand, _: &mut Window, cx: &mut Context<Self>) {
		self.stop(cx);
	}

	fn render_field(
		&self,
		ix: usize,
		control: &Control,
		cx: &mut Context<Self>,
	) -> gpui::AnyElement {
		let field = &control.field;
		let heading = div()
			.flex()
			.items_baseline()
			.gap(px(8.))
			.child(
				div()
					.flex_1()
					.min_w_0()
					.flex()
					.text_size(theme::TEXT_UI)
					.font_weight(FontWeight::MEDIUM)
					.text_color(theme::color(theme::TEXT))
					.child(form::label(&field.name))
					.when(field.required, |label| {
						label.child(
							div()
								.ml(px(3.))
								.text_color(theme::color(theme::ACCENT_HOVER))
								.child("*"),
						)
					}),
			)
			.child(
				div()
					.flex_none()
					.font_family(theme::mono_font())
					.text_size(theme::TEXT_EYEBROW)
					.text_color(theme::color(theme::TEXT_FAINT))
					.child(form::syntax(field)),
			);
		let description = field.description.clone().map(|text| {
			div()
				.text_size(theme::TEXT_SMALL)
				.line_height(px(17.))
				.child(prose(&text, theme::TEXT_MUTED))
		});
		let column = div().flex().flex_col().gap(px(6.));
		match &control.input {
			Input::Bool(on) => {
				let on = *on;
				column
					.child(
						div()
							.flex()
							.items_start()
							.gap(px(12.))
							.child(
								div()
									.flex_1()
									.min_w_0()
									.flex()
									.flex_col()
									.gap(px(4.))
									.child(heading)
									.children(description),
							)
							.child(Switch::new(("switch", ix)).checked(on).mt(px(1.)).on_click(
								cx.listener(move |this, checked: &bool, _, cx| {
									if let Some(Input::Bool(value)) =
										this.controls.get_mut(ix).map(|control| &mut control.input)
									{
										*value = *checked;
									}
									this.error = None;
									cx.notify();
								}),
							)),
					)
					.into_any_element()
			}
			Input::Choice(choices, selected) => {
				column
					.child(heading)
					.child(segmented(
						("choices", ix),
						choices,
						*selected,
						cx.listener(move |this, clicked: &usize, _, cx| {
							let clicked = *clicked;
							if let Some(Input::Choice(_, selected)) =
								this.controls.get_mut(ix).map(|control| &mut control.input)
							{
								// Picking the chosen item again clears an optional choice.
								*selected = (*selected != Some(clicked)).then_some(clicked);
							}
							this.error = None;
							cx.notify();
						}),
					))
					.children(description)
					.into_any_element()
			}
			Input::Text(state) => column
				.child(heading)
				.child(crate::widgets::field(TextField::new(state).cleanable(true)))
				.children(description)
				.into_any_element(),
		}
	}

	fn render_form(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let running = self.transcript.is_running();
		let fields: Vec<gpui::AnyElement> = self
			.controls
			.iter()
			.enumerate()
			.map(|(ix, control)| self.render_field(ix, control, cx))
			.collect();
		let empty = fields.is_empty();
		let verb = if nav::is_long_running(&self.spec.name) {
			"Start"
		} else {
			"Run"
		};
		// A raised button: the 3px margin holds its ledge, so the bar centres body and ledge together.
		let action = if running {
			raised_button(
				"stop",
				Raised::Destructive,
				Some("icons/square.svg"),
				"Stop",
				true,
			)
			.w_full()
			.on_click(cx.listener(|this, _, _, cx| this.stop(cx)))
		} else {
			let label = format!("{verb} {}", nav::title(&self.spec.name));
			raised_button("run", Raised::Primary, Some("icons/play.svg"), label, true)
				.w_full()
				.on_click(cx.listener(|this, _, window, cx| this.run(window, cx)))
		};
		div()
			.flex_none()
			.w(px(FORM_WIDTH))
			.h_full()
			.flex()
			.flex_col()
			// On the panel colour the sunk fields read as wells, not as holes in the page.
			.bg(theme::color(theme::PANEL))
			.border_r_1()
			.border_color(theme::color(theme::BORDER))
			.child(
				div()
					.flex_1()
					.min_h_0()
					.relative()
					.flex()
					.flex_col()
					.child(SmoothScroll::new(
						"form-glide",
						&self.form_scroll,
						div()
							.id("form")
							.flex_1()
							.min_h_0()
							.overflow_y_scroll()
							.track_scroll(&self.form_scroll)
							.flex()
							.flex_col()
							.gap(px(20.))
							.p(px(theme::GUTTER))
							.child(
								div()
									.text_size(theme::TEXT_UI)
									.line_height(px(20.))
									.child(prose(&self.spec.description, theme::TEXT_SECONDARY)),
							)
							.when(!empty, |column| {
								column.child(
									div()
										.flex()
										.flex_col()
										.gap(px(18.))
										.pt(px(16.))
										.border_t_1()
										.border_color(theme::color(theme::BORDER))
										.child(eyebrow("Options"))
										.children(fields),
								)
							})
							.when(empty, |column| {
								column.child(
									div()
										.text_size(theme::TEXT_SMALL)
										.text_color(theme::color(theme::TEXT_MUTED))
										.child("This command takes no options."),
								)
							}),
					))
					.vertical_scrollbar(&self.form_scroll),
			)
			.when_some(self.error.clone(), |form, error| {
				form.child(
					div()
						.flex_none()
						.px(px(theme::GUTTER))
						.py(px(10.))
						.border_t_1()
						.border_color(theme::alpha(theme::ERROR, 0.25))
						.bg(theme::alpha(theme::ERROR, 0.08))
						.text_size(theme::TEXT_SMALL)
						.line_height(px(16.))
						.text_color(theme::color(theme::ERROR))
						.child(error),
				)
			})
			.child(footer_bar().px(px(theme::GUTTER)).child(action))
	}

	fn render_status(&self) -> gpui::AnyElement {
		let (label, color) = match self.transcript.state {
			RunState::Idle => return div().into_any_element(),
			RunState::Running => ("Running".to_owned(), theme::WARNING),
			RunState::Exited(Some(0)) => ("Succeeded".to_owned(), theme::SUCCESS),
			RunState::Exited(Some(code)) => (format!("Exited with {code}"), theme::ERROR),
			RunState::Exited(None) => ("Stopped".to_owned(), theme::TEXT_MUTED),
			RunState::Failed => ("Could not start".to_owned(), theme::ERROR),
		};
		div()
			.flex()
			.items_center()
			.gap(px(6.))
			.h(px(20.))
			.px(px(8.))
			.rounded_full()
			.bg(theme::alpha(color, 0.12))
			.text_size(theme::TEXT_SMALL)
			.text_color(theme::color(color))
			.child(div().size(px(6.)).rounded_full().bg(theme::color(color)))
			.child(label)
			.into_any_element()
	}

	fn render_output(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let has_output = !self.transcript.lines.is_empty();
		let lines = self.transcript.lines.iter().map(|(kind, line)| {
			let color = match kind {
				LineKind::Out => theme::TEXT,
				LineKind::Err => theme::ERROR,
				LineKind::Note => theme::TEXT_MUTED,
			};
			div()
				.min_h(px(19.))
				.text_color(theme::color(color))
				.child(line.clone())
		});
		let body = if has_output {
			let transcript = div()
				.id("transcript")
				.flex_1()
				.min_h_0()
				.overflow_y_scroll()
				.track_scroll(&self.scroll)
				.px(px(theme::GUTTER))
				.py(px(12.))
				.font_family(theme::mono_font())
				.text_size(theme::TEXT_MONO)
				.line_height(px(19.))
				.when(self.transcript.dropped > 0, |body| {
					body.child(
						div()
							.text_color(theme::color(theme::TEXT_FAINT))
							.child(format!("… {} earlier lines", self.transcript.dropped)),
					)
				})
				.children(lines);
			SmoothScroll::new("transcript-glide", &self.scroll, transcript).into_any_element()
		} else {
			let line = self.command_line(cx).unwrap_or_else(|| self.usage());
			div()
				.flex_1()
				.flex()
				.flex_col()
				.items_center()
				.justify_center()
				.gap(px(10.))
				.px(px(32.))
				.child(
					div()
						.text_size(theme::TEXT_UI)
						.text_color(theme::color(theme::TEXT_MUTED))
						.child("Nothing has run yet. Its output shows here."),
				)
				.child(
					div()
						.max_w_full()
						.px(px(10.))
						.py(px(6.))
						.rounded(theme::RADIUS_CONTROL)
						.bg(theme::color(theme::PANEL))
						.border_1()
						.border_color(theme::color(theme::BORDER))
						.font_family(theme::mono_font())
						.text_size(theme::TEXT_SMALL)
						.text_color(theme::color(theme::TEXT_SECONDARY))
						.truncate()
						.child(format!("$ {line}")),
				)
				.into_any_element()
		};
		div()
			.flex_1()
			.min_w_0()
			.h_full()
			.flex()
			.flex_col()
			.bg(theme::color(theme::FIELD))
			.child(
				div()
					.flex_none()
					.h(theme::PANEL_HEADER_HEIGHT)
					.flex()
					.items_center()
					.gap(px(10.))
					// Ghost buttons pad their labels by 8px, so the right edge pads 8px less.
					.pl(px(theme::GUTTER))
					.pr(px(theme::GUTTER - 8.))
					.border_b_1()
					.border_color(theme::color(theme::BORDER))
					.bg(theme::color(theme::PANEL))
					.child(eyebrow("Output"))
					.child(self.render_status())
					.child(div().flex_1())
					.children(self.transcript.duration().map(|duration| {
						div()
							.text_size(theme::TEXT_SMALL)
							.text_color(theme::color(theme::TEXT_MUTED))
							.child(duration)
					}))
					.child(
						ghost_button("copy-output", "icons/copy.svg", "Copy", has_output).when(
							has_output,
							|button| {
								button.on_click(cx.listener(|this, _, _, cx| {
									cx.write_to_clipboard(ClipboardItem::new_string(
										this.transcript.text(),
									));
								}))
							},
						),
					)
					.child(
						ghost_button("clear-output", "icons/eraser.svg", "Clear", has_output).when(
							has_output,
							|button| {
								button.on_click(cx.listener(|this, _, _, cx| {
									this.transcript.clear();
									cx.notify();
								}))
							},
						),
					),
			)
			.child(body)
			.child(self.render_shortcuts())
	}

	/// The output pane's footer: the keys that run or stop the command from anywhere on the page.
	fn render_shortcuts(&self) -> impl IntoElement {
		let (keys, action): (&[&str], &str) = if self.transcript.is_running() {
			(&["Ctrl", "C"], "stops it")
		} else if cfg!(target_os = "macos") {
			(&["⌘", "↵"], "runs it")
		} else {
			(&["Ctrl", "↵"], "runs it")
		};
		footer_bar()
			.gap(px(4.))
			.px(px(theme::GUTTER))
			.children(keys.iter().map(|key| kbd(*key)))
			.child(
				div()
					.ml(px(4.))
					.child(format!("{action} from anywhere on this page")),
			)
	}
}

impl Focusable for CommandPage {
	fn focus_handle(&self, _: &App) -> FocusHandle {
		self.focus.clone()
	}
}

impl Render for CommandPage {
	fn render(&mut self, _: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let title = nav::title(&self.spec.name);
		let group = nav::group_of(&self.spec.name).unwrap_or("Commands");
		let line = self.command_line(cx);
		div()
			.key_context(CONTEXT)
			.track_focus(&self.focus)
			.on_action(cx.listener(Self::on_run))
			.on_action(cx.listener(Self::on_stop))
			.size_full()
			.flex()
			.flex_col()
			.child(
				page_header(group, title).child(
					page_header_end().justify_end().child(
						raised_button(
							"copy-command",
							Raised::Secondary,
							Some("icons/terminal.svg"),
							"Copy Command",
							line.is_some(),
						)
						.tooltip(tooltip("Copy the ubd command these options make"))
						.on_click(move |_, _, cx| {
							if let Some(line) = &line {
								cx.write_to_clipboard(ClipboardItem::new_string(line.clone()));
							}
						}),
					),
				),
			)
			.child(
				div()
					.flex_1()
					.min_h_0()
					.flex()
					.child(self.render_form(cx))
					.child(self.render_output(cx)),
			)
	}
}
