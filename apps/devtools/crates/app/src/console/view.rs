//! The Console page's layout: the entries that ran above, the editor below, and a footer saying
//! whether types are ready.

use gpui::{AnyElement, App, Context, IntoElement, Window, div, prelude::*, px};
use gpui_component::input::{Editor, Enter, Escape, IndentInline, MoveDown, MoveUp};

use super::assist::Assist;
use super::output::Folds;
use super::{Console, Entry, Outcome, TypesState, brackets, keys};
use crate::empty_state::EmptyState;
use crate::nav;
use crate::theme;
use crate::widgets::{
	Raised, footer_bar, mono_char_width, page_header, page_header_end, raised_button, tooltip,
};

const EDITOR_HEIGHT: f32 = 148.;

fn size_label(bytes: usize) -> String {
	if bytes < 1024 {
		format!("{bytes} B")
	} else {
		format!("{:.1} KB", bytes as f32 / 1024.)
	}
}

fn render_entry(entry: &mut Entry, folds: &Folds, cx: &mut Context<Console>) -> AnyElement {
	let meta = match entry.outcome {
		Outcome::Running => format!("${} · running", entry.n),
		_ => format!(
			"${} · {} ms · {}",
			entry.n,
			entry.elapsed.as_millis(),
			size_label(entry.bytes)
		),
	};
	let (result, tone) = match &mut entry.outcome {
		Outcome::Running => ("…".into_any_element(), theme::TEXT_FAINT),
		Outcome::Value { output, .. } => (
			div()
				.flex()
				.flex_col()
				.children(output.render(folds, cx))
				.into_any_element(),
			theme::TEXT,
		),
		Outcome::Error(error) => (error.clone().into_any_element(), theme::ERROR),
	};
	let truncated = matches!(
		entry.outcome,
		Outcome::Value {
			truncated: true,
			..
		}
	);
	div()
		.flex_none()
		.flex()
		.flex_col()
		.gap(px(6.))
		.px(px(theme::GUTTER))
		.py(px(10.))
		.border_b_1()
		.border_color(theme::color(theme::BORDER))
		.font_family(theme::mono_font())
		.text_size(theme::TEXT_MONO)
		.child(
			div()
				.flex()
				.gap(px(10.))
				.child(
					div()
						.flex_none()
						.text_color(theme::color(theme::ACCENT))
						.child("›"),
				)
				.child(
					div()
						.flex_1()
						.min_w_0()
						.text_color(theme::color(theme::TEXT))
						.child(entry.code.styled(cx)),
				)
				.child(
					div()
						.flex_none()
						.font_family(theme::ui_font())
						.text_size(theme::TEXT_SMALL)
						.text_color(theme::color(theme::TEXT_FAINT))
						.child(meta),
				),
		)
		.child(
			div()
				.flex()
				.gap(px(10.))
				.child(div().flex_none().w(px(8.)))
				.child(
					div()
						.flex_1()
						.min_w_0()
						.text_color(theme::color(tone))
						.child(result),
				),
		)
		.when(truncated, |entry| {
			entry.child(
				div()
					.pl(px(18.))
					.font_family(theme::ui_font())
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(theme::WARNING))
					.child(
						"Preview trimmed; open a folded value to read it from the device, where the full value stays as the $ name above.",
					),
			)
		})
		.into_any_element()
}

fn render_intro() -> AnyElement {
	EmptyState::new("icons/square-terminal.svg", "Run TypeScript on the Device")
		.body("Type below and press Enter. Completions and errors come from Unbound's API types, and each result stays on the device as $1, $2, … for later entries.")
		.child(
			div()
				.text_center()
				.text_size(theme::TEXT_SMALL)
				.text_color(theme::color(theme::TEXT_FAINT))
				.child("Shift+Enter adds a line · Cmd/Ctrl+Enter runs inside a block"),
		)
		.into_any_element()
}

impl Console {
	/// Enter accepts the completion, else adds a line while the input goes on, else runs.
	fn enter(&mut self, action: &Enter, window: &mut Window, cx: &mut Context<Self>) {
		if action.shift || action.secondary {
			return;
		}
		if self
			.assist
			.update(cx, |assist, cx| assist.accept(window, cx))
		{
			cx.stop_propagation();
		} else if brackets::continues_input(
			&self.editor.read(cx).value(),
			self.editor.read(cx).cursor(),
		) {
			cx.stop_propagation();
			window.dispatch_action(
				Box::new(Enter {
					shift: true,
					secondary: false,
				}),
				cx,
			);
		}
	}

	/// The editor, with the completion menu's and recall's keys taken before the editor sees them.
	fn render_editor(&self, cx: &mut Context<Self>) -> impl IntoElement {
		let assist = self.assist.clone();
		let keys = |handle: fn(&mut Assist, &mut Window, &mut Context<Assist>) -> bool| {
			let assist = assist.clone();
			move |window: &mut Window, cx: &mut App| {
				if assist.update(cx, |assist, cx| handle(assist, window, cx)) {
					cx.stop_propagation();
				}
			}
		};
		let tab = keys(|assist, window, cx| assist.accept(window, cx));
		let escape =
			keys(|assist, _, cx| assist.dismiss_completions(cx) || assist.dismiss_signature(cx));
		let hover = assist.clone();
		div()
			.id("console-editor")
			.key_context(keys::CONTEXT)
			.flex_none()
			.h(px(EDITOR_HEIGHT))
			.border_t_1()
			.border_color(theme::color(theme::BORDER))
			.bg(theme::color(theme::PANEL))
			.capture_action(cx.listener(Self::enter))
			.capture_action(move |_: &IndentInline, window, cx| tab(window, cx))
			.capture_action(cx.listener(|this, _: &MoveUp, window, cx| {
				if this.step(true, window, cx) {
					cx.stop_propagation();
				}
			}))
			.capture_action(cx.listener(|this, _: &MoveDown, window, cx| {
				if this.step(false, window, cx) {
					cx.stop_propagation();
				}
			}))
			.capture_action(move |_: &Escape, window, cx| escape(window, cx))
			.on_action(cx.listener(Self::toggle_comment))
			.on_action(cx.listener(Self::move_lines_up))
			.on_action(cx.listener(Self::move_lines_down))
			.on_action(cx.listener(Self::duplicate_lines))
			.on_action(cx.listener(Self::delete_lines))
			.on_action(cx.listener(Self::select_lines))
			.on_action(cx.listener(Self::show_signature))
			.on_hover(move |hovered, _, cx| {
				hover.update(cx, |assist, cx| assist.set_pointer_on_editor(*hovered, cx));
			})
			.child(Editor::new(&self.editor).size_full().bordered(false))
			.child(self.assist.clone())
	}
}

impl Render for Console {
	fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		self.motion.settle();
		if self.motion.moving() {
			window.request_animation_frame();
		}
		if self.follow_bottom {
			self.scroll.scroll_to_bottom();
			self.follow_bottom = self.motion.moving();
		}
		let char = mono_char_width(window);
		let types = match &self.types {
			TypesState::Loading => "Loading types…".into(),
			TypesState::Ready => "Typed against @unbound-app/api · tsrs".into(),
			TypesState::Failed(error) => format!("Types unavailable: {error}"),
		};
		let has_entries = !self.entries.is_empty();
		let output = div()
			.id("console-output")
			.flex_1()
			.min_h_0()
			.overflow_y_scroll()
			.track_scroll(&self.scroll)
			.flex()
			.flex_col()
			.when(!has_entries, |output| output.child(render_intro()))
			.children({
				let Self {
					entries,
					open,
					motion,
					..
				} = self;
				entries
					.iter_mut()
					.map(|entry| {
						let folds = Folds {
							n: entry.n,
							open,
							motion,
							char,
						};
						render_entry(entry, &folds, cx)
					})
					.collect::<Vec<_>>()
			});
		div()
			.size_full()
			.flex()
			.flex_col()
			.child(
				page_header(nav::COMPONENTS_GROUP, nav::CONSOLE_TITLE).child(
					page_header_end().justify_end().child(
						raised_button(
							"clear-console",
							Raised::Secondary,
							Some("icons/eraser.svg"),
							"Clear",
							has_entries,
						)
						.tooltip(tooltip("Clear the entries; $n values stay on the device"))
						.when(has_entries, |button| {
							button.on_click(cx.listener(|this, _, _, cx| this.clear(cx)))
						}),
					),
				),
			)
			.child(output)
			.child(self.render_editor(cx))
			.child(
				footer_bar()
					.pl(px(theme::GUTTER))
					.pr(px(theme::GUTTER - 8.))
					.child(div().flex_1().min_w_0().truncate().child(types))
					.child(self.mcp.clone()),
			)
	}
}
