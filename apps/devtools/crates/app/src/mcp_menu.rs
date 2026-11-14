//! The MCP button at the right of every page's footer, and its menu: add this app's MCP endpoint to
//! an agent in one click, or copy the URL. Each row presses like a flat control, and its glyph swaps
//! to a tick once done. One entity, so every page shows the same note and open menu.

use std::time::Duration;

use gpui::{
	Anchor, AnyElement, ClipboardItem, Context, Entity, FontWeight, MouseButton, SharedString,
	Task, Window, anchored, deferred, div, point, prelude::*, px, relative,
};
use unbound_devtools_core::Devtools;

use crate::agents::{self, Agent, Install, Outcome};
use crate::app::on_runtime;
use crate::copy_glyph::{Copied, copied_state, element_id, show_tick, tick_glyphs};
use crate::popout::{Frame, Popout};
use crate::press::Pressable;
use crate::update::toast::{self, Toast};
use crate::widgets::{float_shadow, ghost_button, tooltip};
use crate::{assets, theme};

const CHANGE_COALESCING_FRAME: Duration = Duration::from_millis(16);
/// How long a note such as `Added to Codex` stays on the button.
const NOTE_FOR: Duration = Duration::from_millis(1600);
const MENU_WIDTH: f32 = 360.;
const MENU_PADDING: f32 = 6.;
/// The gap between the button and the menu above it.
const MENU_GAP: f32 = 6.;
const ROW_HEIGHT: f32 = 44.;
const GLYPH: f32 = 14.;
/// The arrow's strokes fill less of its box than the other glyphs, so it draws larger to match.
const ARROW_GLYPH: f32 = 17.;
/// A row's hover reaches its face, which is drawn inside the pressable's unscaled box.
const ROW_GROUP: &str = "mcp-agent";

pub struct McpButton {
	devtools: Devtools,
	/// The endpoint the app serves; `None` hides the button.
	url: Option<String>,
	/// What the button says for a moment after an action, such as `Added to Codex`.
	note: Option<SharedString>,
	note_reset: Option<Task<()>>,
	menu: Popout,
	_watch: Task<()>,
}

impl McpButton {
	pub fn new(devtools: Devtools, cx: &mut Context<Self>) -> Self {
		let watch = cx.spawn({
			let mut changes = devtools.changes();
			async move |this, cx| {
				while changes.changed().await.is_ok() {
					changes.borrow_and_update();
					if this.update(cx, |this, cx| this.refresh(cx)).is_err() {
						break;
					}
					cx.background_executor()
						.timer(CHANGE_COALESCING_FRAME)
						.await;
				}
			}
		});
		Self {
			url: devtools.status().mcp_url,
			devtools,
			note: None,
			note_reset: None,
			menu: Popout::default(),
			_watch: watch,
		}
	}

	fn refresh(&mut self, cx: &mut Context<Self>) {
		let url = self.devtools.status().mcp_url;
		if url != self.url {
			self.url = url;
			cx.notify();
		}
	}

	fn set_menu(&mut self, open: bool, cx: &mut Context<Self>) {
		self.menu.set(open);
		cx.notify();
	}

	/// Has the button say `note` until the next note.
	fn hold_note(&mut self, note: SharedString, cx: &mut Context<Self>) {
		self.note = Some(note);
		self.note_reset = None;
		cx.notify();
	}

	/// Has the button say `note` for [`NOTE_FOR`].
	fn flash_note(&mut self, note: SharedString, cx: &mut Context<Self>) {
		self.note = Some(note);
		self.note_reset = Some(cx.spawn(async move |this, cx| {
			cx.background_executor().timer(NOTE_FOR).await;
			this.update(cx, |this, cx| {
				this.note = None;
				cx.notify();
			})
			.ok();
		}));
		cx.notify();
	}

	/// Adds this app to `agent` the way it takes it: runs its CLI, opens its install link, or copies.
	/// The CLI and the link run on the core's runtime, so a slow shell or editor launch never stalls
	/// the window. `tick` is the row's glyph, which swaps to a tick once that is done.
	fn add_to_agent(&mut self, agent: Agent, tick: Entity<Copied>, cx: &mut Context<Self>) {
		match agent.install {
			Install::Cli { program, args } => {
				self.hold_note("Adding…".into(), cx);
				let request = on_runtime(&self.devtools, agents::run(program, args));
				cx.spawn(async move |this, cx| {
					let outcome = request
						.await
						.unwrap_or_else(|| Outcome::Failed("the run was cancelled".to_owned()));
					this.update(cx, |this, cx| {
						let added = format!("Added to {}", agent.name);
						this.added_to_agent(agent.name, added, agent.text, "command", outcome, cx);
						show_tick(&tick, cx.entity_id(), cx);
					})
					.ok();
				})
				.detach();
			}
			Install::Link(link) => {
				self.hold_note("Opening…".into(), cx);
				let request = on_runtime(&self.devtools, agents::open(link));
				cx.spawn(async move |this, cx| {
					let outcome = request
						.await
						.unwrap_or_else(|| Outcome::Failed("the run was cancelled".to_owned()));
					this.update(cx, |this, cx| {
						let opened = format!("Opened {}", agent.name);
						this.added_to_agent(agent.name, opened, agent.text, "link", outcome, cx);
						show_tick(&tick, cx.entity_id(), cx);
					})
					.ok();
				})
				.detach();
			}
			// The row's tick says it copied; the button stays as it was.
			Install::Copy => {
				cx.write_to_clipboard(ClipboardItem::new_string(agent.text));
				show_tick(&tick, cx.entity_id(), cx);
			}
		}
	}

	/// Success flashes `done` on the button. A failure copies `text`, the `noun` to run or open by
	/// hand, and says so in a toast, seen from any page.
	fn added_to_agent(
		&mut self,
		name: &str,
		done: String,
		text: String,
		noun: &str,
		outcome: Outcome,
		cx: &mut Context<Self>,
	) {
		let message = match outcome {
			Outcome::Added => {
				self.flash_note(done.into(), cx);
				return;
			}
			Outcome::NotInstalled => {
				let program = text.split_whitespace().next().unwrap_or(name);
				format!(
					"{program} isn't installed or isn't on your PATH. Copied the {noun} to use yourself."
				)
			}
			Outcome::Failed(error) => {
				tracing::warn!("Failed to add Unbound DevTools to {name}: {error}");
				format!("{error}. Copied the {noun} to use yourself.")
			}
		};
		self.note = None;
		self.note_reset = None;
		cx.write_to_clipboard(ClipboardItem::new_string(text));
		toast::show(
			Toast {
				title: format!("Couldn't add to {name}").into(),
				message: message.into(),
				action: None,
				stays: false,
			},
			cx,
		);
		cx.notify();
	}

	fn render_backdrop(&self, window: &Window, cx: &mut Context<Self>) -> impl IntoElement {
		let size = window.viewport_size();
		deferred(
			anchored().position(point(px(0.), px(0.))).child(
				div()
					.id("mcp-backdrop")
					.w(size.width)
					.h(size.height)
					.occlude()
					.on_mouse_down(
						MouseButton::Left,
						cx.listener(|this, _, _, cx| this.set_menu(false, cx)),
					),
			),
		)
	}

	fn render_menu(
		&self,
		url: &str,
		frame: Frame,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> AnyElement {
		let s = frame.scale;
		let rows = agents::agents(url)
			.into_iter()
			.enumerate()
			.map(|(ix, agent)| render_agent(ix, agent, s, window, cx))
			.collect::<Vec<_>>();
		div()
			.id("mcp-menu")
			.w(px(MENU_WIDTH * s))
			.p(px(MENU_PADDING * s))
			.rounded(theme::RADIUS_SURFACE * s)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(theme::color(theme::BORDER_STRONG))
			.shadow(float_shadow())
			.opacity(frame.opacity)
			.font_family(theme::ui_font())
			.text_size(theme::TEXT_UI * s)
			.occlude()
			.child(
				div()
					.px(px(theme::INSET * s))
					.pt(px(4. * s))
					.pb(px(6. * s))
					.text_size(theme::TEXT_SMALL * s)
					.text_color(theme::color(theme::TEXT_MUTED))
					.child("Add this app to an agent"),
			)
			.children(rows)
			.into_any_element()
	}
}

impl Render for McpButton {
	fn render(&mut self, window: &mut Window, cx: &mut Context<Self>) -> impl IntoElement {
		let Some(url) = self.url.clone() else {
			return div().into_any_element();
		};
		let open = self.menu.is_open();
		let frame = self.menu.frame(window);
		let label = self.note.clone().unwrap_or("MCP".into());
		let button = ghost_button("mcp", assets::PLUG, label, true)
			.h(px(28.))
			.when(open, |button| button.bg(theme::color(theme::HOVER)))
			.when(!open, |button| {
				button.tooltip(tooltip("Add this app to an agent"))
			})
			.on_click(cx.listener(move |this, _, _, cx| this.set_menu(!open, cx)));
		let backdrop = open.then(|| self.render_backdrop(window, cx).into_any_element());
		let menu = frame.map(|frame| (frame, self.render_menu(&url, frame, window, cx)));
		div()
			.relative()
			.child(button)
			.children(backdrop)
			.when_some(menu, |anchor, (frame, menu)| {
				// Above the button. It grows from Base UI's origin for an end-aligned popup: its right
				// edge, level with the button's top, so the gap scales too.
				anchor.child(
					div().absolute().right_0().top_0().child(
						deferred(
							anchored()
								.anchor(Anchor::BottomRight)
								.offset(point(px(0.), px(-MENU_GAP * frame.scale)))
								.snap_to_window_with_margin(px(8.))
								.child(menu),
						)
						.with_priority(1),
					),
				)
			})
			.into_any_element()
	}
}

/// One agent's row: its name over the command it runs or what clicking does, and a glyph that
/// swaps to a tick once done. The whole row is the control.
fn render_agent(
	ix: usize,
	agent: Agent,
	s: f32,
	window: &mut Window,
	cx: &mut Context<McpButton>,
) -> AnyElement {
	let id = format!("mcp-agent-{ix}");
	let tick = copied_state(&id, window, cx);
	let showing = tick.read(cx).showing;
	let (subtitle, glyph, glyph_size): (SharedString, _, _) = match &agent.install {
		Install::Cli { .. } => (agent.text.clone().into(), assets::PLAY, GLYPH),
		Install::Link(_) => (
			format!("Opens {} to confirm", agent.name).into(),
			assets::ARROW_UP_RIGHT,
			ARROW_GLYPH,
		),
		Install::Copy => (agent.text.clone().into(), assets::COPY, GLYPH),
	};
	let mono = !matches!(agent.install, Install::Link(_));
	let name = agent.name;
	let glyph_id = id.clone();
	// The pressable keeps the row's unscaled box in the layout; its face scales inside it.
	let face = move |press: f32| {
		let inset = relative((1. - press) / 2.);
		let k = press * s;
		div()
			.absolute()
			.top(inset)
			.bottom(inset)
			.left(inset)
			.right(inset)
			.flex()
			.items_center()
			.gap(px(8. * k))
			.px(px(theme::INSET * k))
			.rounded(theme::RADIUS_CONTROL * k)
			.group_hover(ROW_GROUP, |face| face.bg(theme::color(theme::HOVER)))
			.child(
				div()
					.flex()
					.flex_col()
					.flex_1()
					.min_w_0()
					.child(
						div()
							.font_weight(FontWeight::MEDIUM)
							.text_size(theme::TEXT_UI * k)
							.text_color(theme::color(theme::TEXT))
							.child(name),
					)
					.child(
						div()
							.truncate()
							.when(mono, |text| text.font_family(theme::mono_font()))
							.text_size(theme::TEXT_EYEBROW * k)
							.text_color(theme::color(theme::TEXT_MUTED))
							.child(subtitle),
					),
			)
			// One column width for every glyph, so their centres line up down the menu.
			.child(
				div()
					.flex_none()
					.flex()
					.justify_center()
					.w(px(ARROW_GLYPH * k))
					.child(tick_glyphs(
						&glyph_id,
						glyph,
						glyph_size * k,
						theme::TEXT_MUTED,
						showing,
					)),
			)
			.into_any_element()
	};
	let body = div()
		.h(px(ROW_HEIGHT * s))
		.group(ROW_GROUP)
		.cursor_pointer();
	Pressable::flat(element_id(&id, "press"), body, face)
		.on_click(cx.listener(move |this, _, _, cx| {
			this.add_to_agent(agent.clone(), tick.clone(), cx);
		}))
		.into_any_element()
}
