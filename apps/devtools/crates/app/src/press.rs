//! The web's `.press` motion (`press-springs.tsx`): a raised control lifts 1px under the mouse,
//! sinks onto its ledge when pressed, and overshoots a touch on release. Only translate and the
//! ledge's depth change, so a press never moves the controls beside it. A flat control
//! (`.press-flat`) scales to 0.96 instead; gpui has no transforms, so it redraws its face with
//! every length multiplied.

use gpui::{
	AnimationExt, AnyElement, App, Div, ElementId, Hsla, InteractiveElement, Interactivity,
	IntoElement, MouseButton, ParentElement, RenderOnce, SpringAnimation, SpringConfig, Stateful,
	StatefulInteractiveElement, StyleRefinement, Styled, Window, px,
};

use crate::theme;
use crate::widgets::ledge_with_highlight;

/// Down is quick and firm so the press registers at once; the web's `PRESS`.
const PRESS: SpringConfig = SpringConfig::new(900., 40., 1.);
/// Release overshoots a touch, like a key; the web's `RELEASE`.
const RELEASE: SpringConfig = SpringConfig::new(520., 22., 1.);
/// A flat control's scale while pressed; the web's `press-flat`.
const FLAT_SCALE: f32 = 0.96;

/// Draws a flat control's face at a scale.
type Face = Box<dyn FnOnce(f32) -> AnyElement>;

/// What a press moves: a raised body on its ledge, or a flat control's scaled face.
enum Kind {
	Ledge { ledge: Hsla, highlight: f32 },
	Flat(Face),
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
enum PressState {
	#[default]
	Rest,
	Hover,
	Pressed,
}

impl PressState {
	/// For a ledge, how far the body sits below its resting place in pixels; for a flat control,
	/// its face's scale.
	fn target(self, kind: &Kind) -> f32 {
		match (kind, self) {
			(Kind::Ledge { .. }, Self::Rest) => 0.,
			(Kind::Ledge { .. }, Self::Hover) => -1.,
			(Kind::Ledge { .. }, Self::Pressed) => f32::from(theme::LEDGE),
			(Kind::Flat(_), Self::Rest | Self::Hover) => 1.,
			(Kind::Flat(_), Self::Pressed) => FLAT_SCALE,
		}
	}
}

/// A control that answers the mouse with the web's press springs.
#[derive(IntoElement)]
pub struct Pressable {
	id: ElementId,
	body: Stateful<Div>,
	kind: Kind,
	enabled: bool,
}

impl Pressable {
	/// A raised body on a ledge of `ledge`, with a top highlight at `highlight` opacity.
	pub fn new(
		id: impl Into<ElementId>,
		body: Div,
		ledge: Hsla,
		highlight: f32,
		enabled: bool,
	) -> Self {
		let id = id.into();
		Self {
			body: body.id(id.clone()),
			id,
			kind: Kind::Ledge { ledge, highlight },
			enabled,
		}
	}

	/// A flat control, such as a sidebar row, whose `face` shrinks a touch while pressed. `body`
	/// holds its place in the layout; `face` draws inside it at the scale it is given.
	pub fn flat(
		id: impl Into<ElementId>,
		body: Div,
		face: impl FnOnce(f32) -> AnyElement + 'static,
	) -> Self {
		let id = id.into();
		Self {
			body: body.id(id.clone()),
			id,
			kind: Kind::Flat(Box::new(face)),
			enabled: true,
		}
	}
}

impl Styled for Pressable {
	fn style(&mut self) -> &mut StyleRefinement {
		self.body.style()
	}
}

impl InteractiveElement for Pressable {
	fn interactivity(&mut self) -> &mut Interactivity {
		self.body.interactivity()
	}
}

impl StatefulInteractiveElement for Pressable {}

impl ParentElement for Pressable {
	fn extend(&mut self, elements: impl IntoIterator<Item = AnyElement>) {
		self.body.extend(elements);
	}
}

impl RenderOnce for Pressable {
	fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
		let state = window.use_keyed_state(self.id.clone(), cx, |_, _| PressState::Rest);
		let current = *state.read(cx);
		let config = if current == PressState::Pressed {
			PRESS
		} else {
			RELEASE
		};
		let view = window.current_view();
		let set = move |next: fn(PressState) -> PressState| {
			let state = state.clone();
			move |_: &mut Window, cx: &mut App| {
				let changed = state.update(cx, |state, _| {
					let changed = next(*state);
					let moved = changed != *state;
					*state = changed;
					moved
				});
				// Notify the view drawing the button now; a refresh alone repaints its cached frame,
				// so the spring would retarget one event late.
				if changed {
					cx.notify(view);
				}
			}
		};
		let hover_in = set(|state| match state {
			PressState::Pressed => state,
			_ => PressState::Hover,
		});
		let hover_out = set(|state| match state {
			PressState::Pressed => state,
			_ => PressState::Rest,
		});
		let press = set(|_| PressState::Pressed);
		let release = set(|_| PressState::Hover);
		let release_out = set(|_| PressState::Rest);
		let body = if self.enabled {
			self.body
				.on_hover(move |hovered, window, cx| {
					if *hovered {
						hover_in(window, cx)
					} else {
						hover_out(window, cx)
					}
				})
				.on_mouse_down(MouseButton::Left, move |_, window, cx| press(window, cx))
				.on_mouse_up(MouseButton::Left, move |_, window, cx| release(window, cx))
				.on_mouse_up_out(MouseButton::Left, move |_, window, cx| {
					release_out(window, cx)
				})
		} else {
			self.body
		};
		let target = current.target(&self.kind);
		let kind = self.kind;
		body.with_spring(
			self.id,
			SpringAnimation::new(config).to(target),
			move |body, value: f32| match kind {
				// The body slides onto the ledge as the ledge shrinks under it, so the bottom edge
				// stays put.
				Kind::Ledge { ledge, highlight } => {
					let depth = (f32::from(theme::LEDGE) - value).max(0.);
					body.relative().top(px(value)).shadow(ledge_with_highlight(
						ledge,
						highlight,
						px(depth),
					))
				}
				Kind::Flat(face) => body.relative().child(face(value)),
			},
		)
	}
}
