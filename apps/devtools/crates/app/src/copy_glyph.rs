//! What every copy control shares: the copy glyph that shrinks away as a tick pops in over it and
//! trades back after a moment, and the click that copies and starts that swap.

use std::time::Duration;

use gpui::{
	AnimationExt, App, ClickEvent, ClipboardItem, Div, ElementId, Entity, EntityId, SharedString,
	SpringAnimation, SpringConfig, Window, div, prelude::*, px,
};

use crate::assets;
use crate::theme::{self, Token};
use crate::widgets::icon;

/// How long the tick stays before the copy glyph returns.
const COPIED_FOR: Duration = Duration::from_millis(1400);
/// The press release's spring: it overshoots a touch, so a glyph pops rather than fades.
const POP: SpringConfig = SpringConfig::new(520., 22., 1.);

/// Whether the tick shows. `generation` counts clicks, so a timer from an earlier click cannot
/// revert a later one.
#[derive(Clone, Copy, Default)]
pub struct Copied {
	generation: u32,
	pub showing: bool,
}

pub fn element_id(id: &str, part: &str) -> ElementId {
	SharedString::from(format!("{id}-{part}")).into()
}

/// The control's copied state, kept across frames under `id`.
pub fn copied_state(id: &str, window: &mut Window, cx: &mut App) -> Entity<Copied> {
	window.use_keyed_state(element_id(id, "copied"), cx, |_, _| Copied::default())
}

/// Both glyphs on one spot, each springing between shown (1) and gone (0), so a swap animates the
/// leaving glyph out as the other comes in, in either direction.
pub fn copy_glyphs(id: &str, size: f32, color: Token, showing: bool) -> Div {
	tick_glyphs(id, assets::COPY, size, color, showing)
}

/// [`copy_glyphs`] resting on `path` instead of the copy glyph, for a control that does something
/// other than copy.
pub fn tick_glyphs(id: &str, path: &'static str, size: f32, color: Token, showing: bool) -> Div {
	let glyph = |part: &str, path: &'static str, color, shown: bool, rest: f32| {
		div()
			.absolute()
			.inset_0()
			.flex()
			.items_center()
			.justify_center()
			.child(
				icon(path, px(size), color).with_spring(
					element_id(id, part),
					SpringAnimation::new(POP)
						.to(if shown { 1. } else { 0. })
						.from(rest),
					move |svg, value: f32| {
						svg.size(px(size * value.max(0.)))
							.opacity(value.clamp(0., 1.))
					},
				),
			)
	};
	div()
		.flex_none()
		.relative()
		.size(px(size))
		.child(glyph("copy", path, color, !showing, 1.))
		.child(glyph(
			"tick",
			"icons/check.svg",
			theme::SUCCESS,
			showing,
			0.,
		))
}

/// Copies `text`, shows the tick, and swaps back after [`COPIED_FOR`]. `view` is the view that
/// draws the control, which must repaint for the springs to retarget.
pub fn copy_on_click(
	state: Entity<Copied>,
	view: EntityId,
	text: SharedString,
) -> impl Fn(&ClickEvent, &mut Window, &mut App) + 'static {
	move |_, _, cx| {
		cx.write_to_clipboard(ClipboardItem::new_string(text.to_string()));
		show_tick(&state, view, cx);
	}
}

/// Shows the tick and swaps back after [`COPIED_FOR`], for a control that copies or finishes some
/// other way. `view` is the view that draws the control.
pub fn show_tick(state: &Entity<Copied>, view: EntityId, cx: &mut App) {
	let generation = state.update(cx, |copied, _| {
		copied.generation += 1;
		copied.showing = true;
		copied.generation
	});
	cx.notify(view);
	let state = state.clone();
	cx.spawn(async move |cx| {
		cx.background_executor().timer(COPIED_FOR).await;
		cx.update(|cx| {
			let reverted = state.update(cx, |copied, _| {
				let current = copied.generation == generation;
				if current {
					copied.showing = false;
				}
				current
			});
			if reverted {
				cx.notify(view);
			}
		});
	})
	.detach();
}
