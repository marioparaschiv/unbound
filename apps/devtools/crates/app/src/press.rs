//! The web's `.press` motion (`press-springs.tsx`): a raised control lifts 1px under the mouse,
//! sinks onto its ledge when pressed, and overshoots a touch on release. Only translate and the
//! ledge's depth change, so a press never moves the controls beside it. A flat control
//! (`.press-flat`) shrinks its plate, the background drawn behind its content, to 0.96 about its
//! centre. Its content holds still, or with `flat_scaled` shrinks with the plate through a GPU
//! scale ([`gpu_scaled`]), laid out once so text never shifts a pixel mid-press.

use gpui::{
	AnimationExt, AnyElement, App, Div, ElementId, Hsla, InteractiveElement, Interactivity,
	IntoElement, MouseButton, ParentElement, RenderOnce, SpringAnimation, SpringConfig, Stateful,
	StatefulInteractiveElement, StyleRefinement, Styled, Window, div, px, relative,
};

use crate::gpu_scaled::gpu_scaled;
use crate::theme;
use crate::widgets::ledge_with_highlight;

/// Down is quick and firm so the press registers at once; the web's `PRESS`.
pub(crate) const PRESS: SpringConfig = SpringConfig::new(900., 40., 1.);
/// Release overshoots a touch, like a key; the web's `RELEASE`.
pub(crate) const RELEASE: SpringConfig = SpringConfig::new(520., 22., 1.);
/// A flat control's scale while pressed; the web's `press-flat`.
pub(crate) const FLAT_SCALE: f32 = 0.96;

/// Styles a flat control's plate: its background, border and corners, drawn at a scale.
type Plate = Box<dyn FnOnce(Div, f32) -> Div>;
/// What a press moves: a raised body on its ledge, or a flat control's plate and, when
/// `scale_content`, the content on it.
enum Kind {
	Ledge { ledge: Hsla, highlight: f32 },
	Flat { plate: Plate, scale_content: bool },
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
			(Kind::Flat { .. }, Self::Rest | Self::Hover) => 1.,
			(Kind::Flat { .. }, Self::Pressed) => FLAT_SCALE,
		}
	}
}

/// A control that answers the mouse with the web's press springs.
#[derive(IntoElement)]
pub struct Pressable {
	id: ElementId,
	body: Stateful<Div>,
	/// Drawn after a flat control's plate, so they sit on it.
	children: Vec<AnyElement>,
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
			children: Vec::new(),
			kind: Kind::Ledge { ledge, highlight },
			enabled,
		}
	}

	/// A flat control, such as a sidebar row, whose plate shrinks a touch while pressed. `body`
	/// lays out its content, added as children, at full size; `plate` styles the background
	/// behind them, given the plate's box and the scale its corners are drawn at.
	pub fn flat(
		id: impl Into<ElementId>,
		body: Div,
		plate: impl FnOnce(Div, f32) -> Div + 'static,
	) -> Self {
		Self::flat_with(id, body, Box::new(plate), false)
	}

	/// [`Pressable::flat`] whose content, its text and icons, shrinks with the plate, such as a
	/// sidebar row.
	pub fn flat_scaled(
		id: impl Into<ElementId>,
		body: Div,
		plate: impl FnOnce(Div, f32) -> Div + 'static,
	) -> Self {
		Self::flat_with(id, body, Box::new(plate), true)
	}

	fn flat_with(id: impl Into<ElementId>, body: Div, plate: Plate, scale_content: bool) -> Self {
		let id = id.into();
		Self {
			body: body.id(id.clone()),
			id,
			children: Vec::new(),
			kind: Kind::Flat {
				plate,
				scale_content,
			},
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
		self.children.extend(elements);
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
		let (kind, children) = (self.kind, self.children);
		body.with_spring(
			self.id,
			SpringAnimation::new(config).to(target),
			move |body, value: f32| match kind {
				// The body slides onto the ledge as the ledge shrinks under it, so the bottom edge
				// stays put.
				Kind::Ledge { ledge, highlight } => {
					let depth = (f32::from(theme::LEDGE) - value).max(0.);
					body.relative()
						.top(px(value))
						.shadow(ledge_with_highlight(ledge, highlight, px(depth)))
						.children(children)
				}
				Kind::Flat {
					plate,
					scale_content,
				} => {
					let inset = relative((1. - value) / 2.);
					let shrunk = div()
						.absolute()
						.top(inset)
						.bottom(inset)
						.left(inset)
						.right(inset);
					let body = body.relative().child(plate(shrunk, value));
					if scale_content {
						body.child(gpu_scaled(div().size_full().children(children), value))
					} else {
						body.children(children)
					}
				}
			},
		)
	}
}
