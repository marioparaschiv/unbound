//! The status bar's MCP button and its menu: add this app's MCP endpoint to an agent in one click,
//! or copy the URL. Each row presses like a flat control, and its glyph swaps to a tick once done.

use gpui::{
	Anchor, AnyElement, Context, Entity, FontWeight, MouseButton, SharedString, Window, anchored,
	deferred, div, point, prelude::*, px, relative,
};

use crate::agents::{self, Agent, Install, Outcome};
use crate::app::{Workspace, on_runtime};
use crate::copy_glyph::{Copied, copied_state, element_id, show_tick, tick_glyphs};
use crate::press::Pressable;
use crate::widgets::{float_shadow, ghost_button, tooltip};
use crate::{assets, theme};

const MENU_WIDTH: f32 = 360.;
const ROW_HEIGHT: f32 = 44.;
const GLYPH: f32 = 14.;
/// The arrow's strokes fill less of its box than the copy glyph's, so it draws larger to match.
const ARROW_GLYPH: f32 = 17.;
/// A row's hover reaches its face, which is drawn inside the pressable's unscaled box.
const ROW_GROUP: &str = "mcp-agent";

impl Workspace {
	/// The button, and the menu above it while open. `None` when the app serves no MCP endpoint.
	pub fn render_mcp(&self, window: &mut Window, cx: &mut Context<Self>) -> Option<AnyElement> {
		let url = self.status.mcp_url.clone()?;
		let label = self.mcp_note.clone().unwrap_or("MCP".into());
		let button = ghost_button("mcp", assets::PLUG, label, true)
			.h(px(28.))
			.when(!self.mcp_menu, |button| {
				button.tooltip(tooltip("Add this app to an agent"))
			})
			.on_click(cx.listener(|this, _, _, cx| {
				this.mcp_menu = !this.mcp_menu;
				cx.notify();
			}));
		let menu = self.mcp_menu.then(|| {
			let backdrop = self.render_mcp_backdrop(window, cx).into_any_element();
			(backdrop, self.render_mcp_menu(&url, window, cx))
		});
		Some(
			div()
				.relative()
				.child(button)
				.when_some(menu, |anchor, (backdrop, menu)| {
					anchor.child(backdrop).child(
						div().absolute().right_0().top_0().child(
							deferred(
								anchored()
									.anchor(Anchor::BottomRight)
									.offset(point(px(0.), px(-6.)))
									.snap_to_window_with_margin(px(8.))
									.child(menu),
							)
							.with_priority(1),
						),
					)
				})
				.into_any_element(),
		)
	}

	fn render_mcp_backdrop(&self, window: &Window, cx: &mut Context<Self>) -> impl IntoElement {
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
						cx.listener(|this, _, _, cx| {
							this.mcp_menu = false;
							cx.notify();
						}),
					),
			),
		)
	}

	fn render_mcp_menu(
		&self,
		url: &str,
		window: &mut Window,
		cx: &mut Context<Self>,
	) -> AnyElement {
		let rows = agents::agents(url)
			.into_iter()
			.enumerate()
			.map(|(ix, agent)| render_agent(ix, agent, window, cx))
			.collect::<Vec<_>>();
		div()
			.id("mcp-menu")
			.w(px(MENU_WIDTH))
			.p(px(6.))
			.rounded(theme::RADIUS_SURFACE)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(theme::color(theme::BORDER_STRONG))
			.shadow(float_shadow())
			.font_family(theme::ui_font())
			.text_size(theme::TEXT_UI)
			.occlude()
			.child(
				div()
					.px(px(theme::INSET))
					.pt(px(4.))
					.pb(px(6.))
					.text_size(theme::TEXT_SMALL)
					.text_color(theme::color(theme::TEXT_MUTED))
					.child("Add this app to an agent"),
			)
			.children(rows)
			.into_any_element()
	}

	/// Adds this app to `agent` the way it takes it: runs its CLI, opens its install link, or copies.
	/// `tick` is the row's glyph, which swaps to a tick once that is done.
	fn add_to_agent(&mut self, agent: Agent, tick: Entity<Copied>, cx: &mut Context<Self>) {
		match agent.install {
			Install::Cli { program, args } => {
				self.hold_mcp("Adding…".into(), cx);
				let request = on_runtime(&self.devtools, agents::run(program, args));
				cx.spawn(async move |this, cx| {
					let outcome = request
						.await
						.unwrap_or_else(|| Outcome::Failed("the run was cancelled".to_owned()));
					this.update(cx, |this, cx| {
						this.added_to_agent(agent.name, program, agent.text, outcome, cx);
						show_tick(&tick, cx.entity_id(), cx);
					})
					.ok();
				})
				.detach();
			}
			Install::Link(link) => {
				cx.open_url(&link);
				self.flash_mcp(format!("Opened {}", agent.name).into(), cx);
				show_tick(&tick, cx.entity_id(), cx);
			}
			Install::Copy => {
				self.copy_text(agent.text, cx);
				show_tick(&tick, cx.entity_id(), cx);
			}
		}
	}

	fn added_to_agent(
		&mut self,
		name: &str,
		program: &str,
		command: String,
		outcome: Outcome,
		cx: &mut Context<Self>,
	) {
		match outcome {
			Outcome::Added => self.flash_mcp(format!("Added to {name}").into(), cx),
			Outcome::NotInstalled => {
				self.copy_text(command, cx);
				self.show_error(
					format!(
						"{program} isn't installed or isn't on your PATH; copied the command to run yourself."
					),
					cx,
				);
			}
			Outcome::Failed(error) => {
				self.copy_text(command, cx);
				self.show_error(
					format!(
						"Failed to add Unbound DevTools to {name}: {error}. Copied the command."
					),
					cx,
				);
			}
		}
	}
}

/// One agent's row: its name over the command it runs or what clicking does, and a glyph that
/// swaps to a tick once done. The whole row is the control.
fn render_agent(
	ix: usize,
	agent: Agent,
	window: &mut Window,
	cx: &mut Context<Workspace>,
) -> AnyElement {
	let id = format!("mcp-agent-{ix}");
	let tick = copied_state(&id, window, cx);
	let showing = tick.read(cx).showing;
	let link = matches!(agent.install, Install::Link(_));
	let (subtitle, glyph, glyph_size): (SharedString, _, _) = if link {
		(
			format!("Opens {} to confirm", agent.name).into(),
			assets::ARROW_UP_RIGHT,
			ARROW_GLYPH,
		)
	} else {
		(agent.text.clone().into(), assets::COPY, GLYPH)
	};
	let name = agent.name;
	let glyph_id = id.clone();
	// The pressable keeps the row's unscaled box in the layout; its face scales inside it.
	let face = move |scale: f32| {
		let inset = relative((1. - scale) / 2.);
		div()
			.absolute()
			.top(inset)
			.bottom(inset)
			.left(inset)
			.right(inset)
			.flex()
			.items_center()
			.gap(px(8. * scale))
			.px(px(theme::INSET * scale))
			.rounded(theme::RADIUS_CONTROL * scale)
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
							.text_size(theme::TEXT_UI * scale)
							.text_color(theme::color(theme::TEXT))
							.child(name),
					)
					.child(
						div()
							.truncate()
							.when(!link, |text| text.font_family(theme::mono_font()))
							.text_size(theme::TEXT_EYEBROW * scale)
							.text_color(theme::color(theme::TEXT_MUTED))
							.child(subtitle),
					),
			)
			// One column width for both glyphs, so their centres line up down the menu.
			.child(
				div()
					.flex_none()
					.flex()
					.justify_center()
					.w(px(ARROW_GLYPH * scale))
					.child(tick_glyphs(
						&glyph_id,
						glyph,
						glyph_size * scale,
						theme::TEXT_MUTED,
						showing,
					)),
			)
			.into_any_element()
	};
	let body = div().h(px(ROW_HEIGHT)).group(ROW_GROUP).cursor_pointer();
	Pressable::flat(element_id(&id, "press"), body, face)
		.on_click(cx.listener(move |this, _, _, cx| {
			this.add_to_agent(agent.clone(), tick.clone(), cx);
		}))
		.into_any_element()
}
