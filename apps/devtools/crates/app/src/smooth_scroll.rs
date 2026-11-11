//! Eases notched mouse-wheel steps into a glide, the way Safari does, for any scroll view.
//! Ported from vyprvpn-native's popover `smooth_scroll.rs`.

use std::cell::RefCell;
use std::rc::Rc;
use std::time::{Duration, Instant};

use gpui::{
	AnyElement, App, Bounds, DispatchPhase, Element, ElementId, GlobalElementId, Hitbox,
	HitboxBehavior, InspectorElementId, IntoElement, LayoutId, Pixels, ScrollDelta, ScrollEvent,
	SpringConfig, SpringState, Window, px,
};
use gpui_component::scroll::ScrollbarHandle;

/// Critically damped (damping = 2 * sqrt(stiffness * mass)), so a glide never overshoots its
/// target. At 25 rad/s a step is 90% done after ~150 ms.
const SPRING: SpringConfig = SpringConfig::new(625., 50., 1.);

/// How close, in pixels, a glide must be to its target to stop.
const SETTLED: f32 = 0.5;

/// One vertical glide of a scroll offset toward a target. Offsets follow gpui: 0 at the top,
/// `-max` at the bottom.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Glide {
	state: SpringState,
	target: f32,
	max: f32,
}

impl Glide {
	pub fn position(&self) -> f32 {
		self.state.position
	}

	pub fn is_running(&self) -> bool {
		self.state.position != self.target || self.state.velocity != 0.
	}

	/// Advances the spring by `elapsed`, held inside the scroll range.
	pub fn advance(self, elapsed: Duration) -> Self {
		let mut state = SPRING.step(self.state, self.target, elapsed.as_secs_f32());

		if SPRING.is_settled(state, self.target, SETTLED) {
			state = SpringState {
				position: self.target,
				velocity: 0.,
			};
		} else if !(-self.max..=0.).contains(&state.position) {
			state = SpringState {
				position: state.position.clamp(-self.max, 0.),
				velocity: 0.,
			};
		}

		Self { state, ..self }
	}
}

/// What a wheel event does to the glide in flight. Notched-wheel lines start a glide, or move
/// the running one's target while keeping its position and velocity. `None` hands the event to
/// the scroll view: precise pixel deltas keep the OS's own momentum, and reduced motion keeps
/// the instant jump.
pub fn on_wheel(
	glide: Option<Glide>,
	offset: f32,
	max: f32,
	delta: &ScrollDelta,
	line_height: Pixels,
	reduce_motion: bool,
) -> Option<Glide> {
	let ScrollDelta::Lines(lines) = delta else {
		return None;
	};
	if reduce_motion || lines.y == 0. {
		return None;
	}

	let glide = glide.unwrap_or(Glide {
		state: SpringState {
			position: offset,
			velocity: 0.,
		},
		target: offset,
		max,
	});

	Some(Glide {
		target: (glide.target + lines.y * line_height.as_f32()).clamp(-max, 0.),
		max,
		..glide
	})
}

/// Wraps a scroll view so its notched-wheel steps glide. `handle` must be the child's scroll
/// handle; everything else (pixel deltas, keyboard, scrollbar drags) stays the child's.
pub struct SmoothScroll {
	id: ElementId,
	handle: Rc<dyn ScrollbarHandle>,
	child: AnyElement,
}

impl SmoothScroll {
	pub fn new<H: ScrollbarHandle + Clone>(
		id: impl Into<ElementId>,
		handle: &H,
		child: impl IntoElement,
	) -> Self {
		Self {
			id: id.into(),
			handle: Rc::new(handle.clone()),
			child: child.into_any_element(),
		}
	}
}

#[derive(Default)]
struct State {
	glide: Option<Glide>,
	sampled_at: Option<Instant>,
}

impl State {
	/// The glide, unless something else moved the view since its last frame.
	fn glide(&mut self, offset: Pixels) -> Option<Glide> {
		self.glide = self
			.glide
			.filter(|glide| glide.position() == offset.as_f32());
		self.glide
	}
}

fn max_offset(handle: &dyn ScrollbarHandle) -> f32 {
	(handle.content_size().height - handle.viewport_bounds().size.height)
		.as_f32()
		.max(0.)
}

#[doc(hidden)]
pub struct SmoothScrollPrepaint {
	state: Rc<RefCell<State>>,
	hitbox: Hitbox,
}

impl IntoElement for SmoothScroll {
	type Element = Self;

	fn into_element(self) -> Self {
		self
	}
}

impl Element for SmoothScroll {
	type RequestLayoutState = ();
	type PrepaintState = SmoothScrollPrepaint;

	fn id(&self) -> Option<ElementId> {
		Some(self.id.clone())
	}

	fn source_location(&self) -> Option<&'static std::panic::Location<'static>> {
		None
	}

	fn request_layout(
		&mut self,
		_: Option<&GlobalElementId>,
		_: Option<&InspectorElementId>,
		window: &mut Window,
		cx: &mut App,
	) -> (LayoutId, ()) {
		(self.child.request_layout(window, cx), ())
	}

	fn prepaint(
		&mut self,
		id: Option<&GlobalElementId>,
		_: Option<&InspectorElementId>,
		bounds: Bounds<Pixels>,
		_: &mut (),
		window: &mut Window,
		cx: &mut App,
	) -> SmoothScrollPrepaint {
		let state = window.with_element_state(
			id.expect("SmoothScroll has an id"),
			|state: Option<Rc<RefCell<State>>>, _| {
				let state = state.unwrap_or_default();
				(state.clone(), state)
			},
		);

		{
			let mut state = state.borrow_mut();
			let mut offset = self.handle.offset();

			if let Some(glide) = state.glide(offset.y) {
				let now = cx.background_executor().now();
				let elapsed = state
					.sampled_at
					.replace(now)
					.map_or(Duration::ZERO, |at| now.saturating_duration_since(at));
				let glide = glide.advance(elapsed);

				offset.y = px(glide.position());
				self.handle.set_offset(offset);
				state.glide = glide.is_running().then_some(glide);

				if state.glide.is_some() {
					window.request_animation_frame();
				}
			}
		}

		let hitbox = window.insert_hitbox(bounds, HitboxBehavior::Normal);
		self.child.prepaint(window, cx);

		SmoothScrollPrepaint { state, hitbox }
	}

	fn paint(
		&mut self,
		_: Option<&GlobalElementId>,
		_: Option<&InspectorElementId>,
		_: Bounds<Pixels>,
		_: &mut (),
		prepaint: &mut SmoothScrollPrepaint,
		window: &mut Window,
		cx: &mut App,
	) {
		let state = prepaint.state.clone();
		let hitbox = prepaint.hitbox.id;
		let handle = self.handle.clone();
		let view = window.current_view();

		// Capture runs before the child's own bubble-phase scrolling, so a glide can take the
		// event first.
		window.on_mouse_event(move |event: &ScrollEvent, phase, window, cx| {
			if phase != DispatchPhase::Capture
				|| !hitbox.should_handle_scroll(window)
				|| !handle.viewport_bounds().contains(&event.position)
			{
				return;
			}

			let mut state = state.borrow_mut();
			let offset = handle.offset().y;
			let running = state.glide(offset);
			let glide = on_wheel(
				running,
				offset.as_f32(),
				max_offset(handle.as_ref()),
				&event.delta,
				window.line_height(),
				cx.reduce_motion(),
			);

			state.glide = glide;
			if glide.is_none() {
				return;
			}
			if running.is_none() {
				state.sampled_at = Some(cx.background_executor().now());
			}

			cx.stop_propagation();
			cx.notify(view);
		});

		self.child.paint(window, cx);
	}
}

#[cfg(test)]
mod tests {
	use gpui::{
		Context, InteractiveElement as _, ParentElement as _, Render, ScrollHandle,
		StatefulInteractiveElement as _, Styled as _, TestAppContext, VisualTestContext, div,
		point,
	};

	use super::*;

	const LINE: Pixels = px(20.);
	const MAX: f32 = 1000.;
	const FRAME: Duration = Duration::from_millis(8);

	fn notch(glide: Option<Glide>, offset: f32, lines: f32) -> Option<Glide> {
		on_wheel(
			glide,
			offset,
			MAX,
			&ScrollDelta::Lines(point(0., lines)),
			LINE,
			false,
		)
	}

	/// Runs a glide to rest, returning every frame's position.
	fn run(mut glide: Glide) -> Vec<f32> {
		let mut positions = Vec::new();

		while glide.is_running() {
			glide = glide.advance(FRAME);
			positions.push(glide.position());
			assert!(positions.len() < 1000, "glide never settled");
		}

		positions
	}

	#[test]
	fn a_notch_eases_out_to_its_target_without_overshoot() {
		let glide = notch(None, -100., -3.).unwrap();
		let positions = run(glide);

		assert_eq!(positions.last(), Some(&-160.));
		assert!(
			positions.windows(2).all(|pair| pair[1] <= pair[0]),
			"moves one way: {positions:?}"
		);
		assert!(positions.iter().all(|&position| position >= -160.));

		let steps: Vec<f32> = positions.windows(2).map(|pair| pair[0] - pair[1]).collect();
		let fastest = steps.iter().cloned().fold(0., f32::max);
		assert!(
			steps.last().unwrap() < &(fastest / 4.),
			"ends slower than it ran: {steps:?}"
		);

		let elapsed = FRAME * u32::try_from(positions.len()).unwrap();
		assert!(
			(Duration::from_millis(150)..=Duration::from_millis(300)).contains(&elapsed),
			"settles in {elapsed:?}"
		);
	}

	#[test]
	fn a_notch_mid_glide_retargets_from_the_current_position_and_velocity() {
		let glide = notch(None, 0., -3.).unwrap().advance(FRAME * 5);
		let retargeted = notch(Some(glide), -999., -3.).unwrap();
		assert_eq!(retargeted.position(), glide.position());
		assert_eq!(retargeted.state.velocity, glide.state.velocity);
		assert_eq!(retargeted.target, -120.);

		let positions = run(retargeted);
		assert_eq!(positions.last(), Some(&-120.));
		assert!(
			positions.windows(2).all(|pair| pair[1] <= pair[0]),
			"keeps going one way: {positions:?}"
		);
	}

	#[test]
	fn a_reversed_notch_turns_back_without_leaving_the_range() {
		let glide = notch(None, -10., 3.).unwrap().advance(FRAME * 3);
		let reversed = notch(Some(glide), -10., -6.).unwrap();
		let positions = run(reversed);

		assert_eq!(reversed.target, -120.);
		assert_eq!(positions.last(), Some(&-120.));
		assert!(
			positions
				.iter()
				.all(|&position| (-120. ..=0.).contains(&position))
		);
	}

	#[test]
	fn glides_stop_at_the_top_and_bottom() {
		let top = notch(None, -20., 3.).unwrap();
		assert_eq!(top.target, 0.);
		assert!(run(top).iter().all(|&position| position <= 0.));

		let bottom = notch(None, -990., -3.).unwrap();
		assert_eq!(bottom.target, -MAX);
		assert!(run(bottom).iter().all(|&position| position >= -MAX));

		let still = notch(None, 0., 3.).unwrap();
		assert!(!still.is_running());
	}

	#[test]
	fn reduced_motion_leaves_the_jump_to_the_view() {
		let delta = ScrollDelta::Lines(point(0., -3.));

		assert_eq!(on_wheel(None, 0., MAX, &delta, LINE, true), None);
	}

	#[test]
	fn pixel_deltas_pass_through_and_end_a_glide() {
		let glide = notch(None, 0., -3.);
		let delta = ScrollDelta::Pixels(point(px(0.), px(-37.)));

		assert_eq!(on_wheel(glide, 0., MAX, &delta, LINE, false), None);
		assert_eq!(on_wheel(None, 0., MAX, &delta, LINE, false), None);
	}

	struct Scrolled {
		handle: ScrollHandle,
	}

	impl Render for Scrolled {
		fn render(&mut self, _: &mut Window, _: &mut Context<Self>) -> impl IntoElement {
			SmoothScroll::new(
				"smooth",
				&self.handle,
				div()
					.id("viewport")
					.w(px(200.))
					.h(px(200.))
					.overflow_y_scroll()
					.track_scroll(&self.handle)
					.child(div().h(px(2000.)).w_full()),
			)
		}
	}

	fn wheel(cx: &mut VisualTestContext, delta: ScrollDelta) {
		cx.simulate_event(ScrollEvent {
			position: point(px(100.), px(100.)),
			delta,
			..Default::default()
		});
	}

	fn frame(cx: &mut VisualTestContext) -> usize {
		cx.executor().advance_clock(FRAME);
		let requested = cx.update(|window, cx| window.simulate_next_frame(cx));
		cx.update(|window, cx| window.draw(cx).clear(cx));
		requested
	}

	#[gpui::test]
	fn the_view_glides_on_notches_and_follows_pixels_directly(cx: &mut TestAppContext) {
		let handle = ScrollHandle::new();
		let (_, cx) = cx.add_window_view({
			let handle = handle.clone();
			move |_, _| Scrolled { handle }
		});
		cx.update(|window, cx| window.draw(cx).clear(cx));
		let line = cx.update(|window, _| window.line_height());

		wheel(cx, ScrollDelta::Lines(point(0., -3.)));
		let first = -handle.offset().y;
		assert!(first < line * 3., "jumped to {first:?}");

		let mut frames = 0;
		while frame(cx) > 0 {
			frames += 1;
			assert!(frames < 100, "glide never settled");
		}
		assert!(frames > 5, "settled in {frames} frames");
		assert_eq!(handle.offset().y, -line * 3.);
		assert_eq!(frame(cx), 0, "idle after the glide");

		wheel(cx, ScrollDelta::Pixels(point(px(0.), px(-37.))));
		cx.update(|window, cx| window.draw(cx).clear(cx));
		assert_eq!(handle.offset().y, -line * 3. - px(37.));
		assert_eq!(frame(cx), 0);
	}
}
