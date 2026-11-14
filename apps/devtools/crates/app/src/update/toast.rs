//! The updater's toast: one card pinned to the window's top-right corner, under the title bar's
//! window buttons. It slides in from the right edge, changes its text in place as the update moves
//! along, and slides back out when dismissed or when a passing message times out.

use std::rc::Rc;
use std::time::{Duration, Instant};

use gpui::{
	App, BorrowAppContext as _, FontWeight, Global, MouseButton, SharedString, Window, div,
	prelude::*, px,
};

use crate::widgets::{Raised, float_shadow, icon, raised_icon_button, tooltip};
use crate::{assets, theme, title_bar};

const WIDTH: f32 = 380.;
/// The gap to the window's right edge and to the title bar.
const INSET: f32 = 12.;
const ENTER: Duration = Duration::from_millis(320);
const EXIT: Duration = Duration::from_millis(200);
/// How long a toast without an action stays up.
const LINGER: Duration = Duration::from_secs(5);
const GROUP: &str = "update-toast";

/// A toast's button: an icon, the tooltip that names it, and what a click does.
pub struct Action {
	pub id: &'static str,
	pub icon: &'static str,
	pub label: &'static str,
	pub run: fn(&mut App),
}

pub struct Toast {
	pub title: SharedString,
	pub message: SharedString,
	pub action: Option<Action>,
	/// Stays up until dismissed or replaced; otherwise it slides out after [`LINGER`].
	pub stays: bool,
}

struct Shown {
	toast: Rc<Toast>,
	entered: Instant,
	leaving: Option<Instant>,
}

/// The toast on screen; the shell observes it to redraw.
#[derive(Default)]
pub struct Toasts {
	shown: Option<Shown>,
	/// Bumped on every change, so a stale timer leaves a newer toast alone.
	generation: u64,
}

impl Global for Toasts {}

pub fn init(cx: &mut App) {
	cx.set_global(Toasts::default());
}

/// Shows `toast`. One already up keeps its place and takes the new text without moving.
pub fn show(toast: Toast, cx: &mut App) {
	let linger = !toast.stays;
	let generation = cx.update_global::<Toasts, _>(|toasts, _| {
		toasts.generation += 1;
		let entered = match &toasts.shown {
			Some(shown) if shown.leaving.is_none() => shown.entered,
			_ => Instant::now(),
		};
		toasts.shown = Some(Shown {
			toast: Rc::new(toast),
			entered,
			leaving: None,
		});
		toasts.generation
	});
	if linger {
		after(LINGER, cx, move |cx| {
			if cx.global::<Toasts>().generation == generation {
				hide(cx);
			}
		});
	}
}

/// Slides the toast out, then drops it.
pub fn hide(cx: &mut App) {
	let generation = cx.update_global::<Toasts, _>(|toasts, _| {
		if let Some(shown) = toasts.shown.as_mut()
			&& shown.leaving.is_none()
		{
			shown.leaving = Some(Instant::now());
			toasts.generation += 1;
		}
		toasts.generation
	});
	after(EXIT, cx, move |cx| {
		cx.update_global::<Toasts, _>(|toasts, _| {
			if toasts.generation == generation {
				toasts.shown = None;
			}
		});
	});
}

fn after(delay: Duration, cx: &mut App, run: impl FnOnce(&mut App) + 'static) {
	cx.spawn(async move |cx| {
		cx.background_executor().timer(delay).await;
		cx.update(run);
	})
	.detach();
}

/// Ease-out cubic: quick to arrive, settling gently.
fn ease_out(t: f32) -> f32 {
	1. - (1. - t).powi(3)
}

/// How far in the toast is, 0 off the right edge to 1 in place, and whether it is still moving.
fn progress(shown: &Shown) -> (f32, bool) {
	let fraction = |since: Instant, length: Duration| {
		(since.elapsed().as_secs_f32() / length.as_secs_f32()).min(1.)
	};
	match shown.leaving {
		None => {
			let t = fraction(shown.entered, ENTER);
			(ease_out(t), t < 1.)
		}
		Some(leaving) => {
			let t = fraction(leaving, EXIT);
			(1. - ease_out(t), t < 1.)
		}
	}
}

/// The toast, positioned over the window, or nothing when none is up.
pub fn render(window: &mut Window, cx: &App) -> Option<impl IntoElement> {
	let shown = cx.global::<Toasts>().shown.as_ref()?;
	let (shown_by, moving) = progress(shown);
	if moving {
		window.request_animation_frame();
	}
	let toast = shown.toast.clone();
	// Starts fully past the window's right edge.
	let offset = (1. - shown_by) * (WIDTH + INSET);
	let text = div()
		.flex_1()
		.min_w_0()
		.flex()
		.flex_col()
		.gap(px(2.))
		.child(
			div()
				.text_size(px(14.))
				.line_height(px(20.))
				.font_weight(FontWeight::SEMIBOLD)
				.text_color(theme::color(theme::TEXT))
				.child(toast.title.clone()),
		)
		.child(
			div()
				.text_size(theme::TEXT_UI)
				.line_height(px(19.))
				.text_color(theme::color(theme::TEXT_SECONDARY))
				.child(toast.message.clone()),
		);
	let card = div()
		.id("update-toast")
		.group(GROUP)
		.relative()
		.w(px(WIDTH))
		.flex()
		.items_center()
		.gap(px(12.))
		.px(px(16.))
		.py(px(14.))
		.rounded(theme::RADIUS_SURFACE)
		.border_1()
		.border_color(theme::color(theme::BORDER))
		.bg(theme::color(theme::PANEL))
		.shadow(float_shadow())
		.opacity(shown_by)
		// Clicks on the card stay on the card, not the page under it.
		.on_mouse_down(MouseButton::Left, |_, _, cx| cx.stop_propagation())
		.child(text)
		.children(toast.action.as_ref().map(|action| {
			let run = action.run;
			raised_icon_button(action.id, Raised::Primary, action.icon)
				.tooltip(tooltip(action.label))
				.on_click(move |_, _, cx| run(cx))
		}))
		.child(close_button());
	Some(
		div()
			.absolute()
			.top(title_bar::height(window) + px(INSET))
			.right(px(INSET - offset))
			.child(card),
	)
}

/// Shown on hover over the card's top-left corner, as macOS places it, clear of the action button.
fn close_button() -> impl IntoElement {
	div()
		.id("update-toast-close")
		.absolute()
		.top(px(-7.))
		.left(px(-7.))
		.size(px(20.))
		.flex()
		.items_center()
		.justify_center()
		.rounded_full()
		.border_1()
		.border_color(theme::color(theme::BORDER))
		.bg(theme::color(theme::PANEL))
		.cursor_pointer()
		.invisible()
		.group_hover(GROUP, |button| button.visible())
		.hover(|button| button.bg(theme::color(theme::HOVER)))
		.child(icon(assets::X, px(10.), theme::TEXT_SECONDARY))
		.tooltip(tooltip("Dismiss"))
		.on_click(|_, _, cx| hide(cx))
}
