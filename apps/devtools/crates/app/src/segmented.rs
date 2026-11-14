//! The web's Segmented control (`apps/web/src/components/ui/segmented.tsx`): equal items on a
//! ringed track and one raised pill under the hovered item, or the chosen one at rest. The pill
//! slides between items, labels fade their colour, and a pressed item shrinks like `.press-flat`.

use std::rc::Rc;
use std::time::{Duration, Instant};

use gpui::{
	AnimationExt, App, Div, ElementId, FontWeight, InteractiveElement, IntoElement, MouseButton,
	ParentElement, RenderOnce, Rgba, SharedString, SpringAnimation, Stateful,
	StatefulInteractiveElement, StyleRefinement, Styled, Window, div, px, relative,
};

use crate::easing::cubic_bezier;
use crate::press::{FLAT_SCALE, PRESS, RELEASE};
use crate::theme;
use crate::widgets::{hairline, key_shadow};

const TRACK_PADDING: f32 = 3.;

/// A CSS transition: how long it runs and its `cubic-bezier`.
#[derive(Clone, Copy)]
struct Curve {
	duration: Duration,
	bezier: [f32; 4],
}

/// The web's `PILL_TIMING`: the pill answers hover at once with a strong ease-out.
const PILL: Curve = Curve {
	duration: Duration::from_millis(250),
	bezier: [0.23, 1., 0.32, 1.],
};

/// Tailwind's `transition-colors`: 150ms on its default ease.
const COLOUR: Curve = Curve {
	duration: Duration::from_millis(150),
	bezier: [0.4, 0., 0.2, 1.],
};

/// A value easing from `from` to `to`; retargeting mid-way starts from where it is.
#[derive(Clone, Copy)]
struct Tween {
	from: f32,
	to: f32,
	start: Instant,
}

impl Tween {
	fn still(value: f32) -> Self {
		Self {
			from: value,
			to: value,
			start: Instant::now(),
		}
	}

	fn progress(&self, curve: Curve) -> f32 {
		(self.start.elapsed().as_secs_f32() / curve.duration.as_secs_f32()).min(1.)
	}

	fn value(&self, curve: Curve) -> f32 {
		self.from + (self.to - self.from) * cubic_bezier(curve.bezier, self.progress(curve))
	}

	fn moving(&self, curve: Curve) -> bool {
		self.from != self.to && self.progress(curve) < 1.
	}

	fn retarget(&mut self, to: f32, curve: Curve, reduce_motion: bool) {
		if to == self.to {
			return;
		}
		let from = if reduce_motion { to } else { self.value(curve) };
		*self = Self {
			from,
			to,
			start: Instant::now(),
		};
	}
}

/// What the mouse is doing to the control, and where its pill and label colours are heading.
#[derive(Default)]
struct Motion {
	hovered: Option<usize>,
	pressed: Option<usize>,
	/// The pill's position in items; `None` while nothing is hovered or chosen.
	pill: Option<Tween>,
	/// Each label's colour, 0 muted to 1 full.
	lit: Vec<Tween>,
}

impl Motion {
	/// Points the pill and labels at the current hover and choice; returns whether any still moves.
	fn retarget(&mut self, count: usize, selected: Option<usize>, reduce_motion: bool) -> bool {
		self.hovered = self.hovered.filter(|ix| *ix < count);
		let target = self.hovered.or(selected);
		let lit = |ix: usize| f32::from(u8::from(selected == Some(ix) || self.hovered == Some(ix)));
		// A pill with nowhere to slide from appears in place, as on the web.
		self.pill = target.map(|ix| {
			let mut pill = self.pill.unwrap_or(Tween::still(ix as f32));
			pill.retarget(ix as f32, PILL, reduce_motion);
			pill
		});
		if self.lit.len() != count {
			self.lit = (0..count).map(|ix| Tween::still(lit(ix))).collect();
		}
		let targets: Vec<f32> = (0..count).map(lit).collect();
		for (tween, to) in self.lit.iter_mut().zip(targets) {
			tween.retarget(to, COLOUR, reduce_motion);
		}
		self.pill.is_some_and(|pill| pill.moving(PILL))
			|| self.lit.iter().any(|tween| tween.moving(COLOUR))
	}
}

fn mix(from: Rgba, to: Rgba, t: f32) -> Rgba {
	let lerp = |a: f32, b: f32| a + (b - a) * t;
	Rgba {
		r: lerp(from.r, to.r),
		g: lerp(from.g, to.g),
		b: lerp(from.b, to.b),
		a: lerp(from.a, to.a),
	}
}

fn press_spring(pressed: bool) -> SpringAnimation<f32> {
	if pressed {
		SpringAnimation::new(PRESS).to(FLAT_SCALE)
	} else {
		SpringAnimation::new(RELEASE).to(1.)
	}
}

/// Called with the clicked item's index.
type OnPick = Rc<dyn Fn(&usize, &mut Window, &mut App)>;

/// A segmented control; see [`segmented`].
#[derive(IntoElement)]
pub struct Segmented {
	id: ElementId,
	track: Stateful<Div>,
	items: Vec<SharedString>,
	selected: Option<usize>,
	on_pick: OnPick,
}

/// @description The web's Segmented control: equal items on a ringed track with a sliding pill.
/// @param id The control's id, which keys its motion.
/// @param items The items' labels.
/// @param selected The chosen item, if any.
/// @param on_pick Called with the clicked item's index.
/// @returns The control, sized like any styled element.
pub fn segmented(
	id: impl Into<ElementId>,
	items: &[String],
	selected: Option<usize>,
	on_pick: impl Fn(&usize, &mut Window, &mut App) + 'static,
) -> Segmented {
	let id = id.into();
	Segmented {
		track: div().id(id.clone()),
		id,
		items: items.iter().map(|item| item.clone().into()).collect(),
		selected,
		on_pick: Rc::new(on_pick),
	}
}

impl Styled for Segmented {
	fn style(&mut self) -> &mut StyleRefinement {
		self.track.style()
	}
}

impl RenderOnce for Segmented {
	fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
		let count = self.items.len();
		let reduce_motion = cx.reduce_motion();
		let state = window.use_keyed_state(self.id.clone(), cx, |_, _| Motion::default());
		let moving = state.update(cx, |motion, _| {
			motion.retarget(count, self.selected, reduce_motion)
		});
		if moving {
			window.request_animation_frame();
		}
		let motion = state.read(cx);
		let pressed = motion.pressed;
		let pill = motion.pill.map(|pill| (pill.to as usize, pill.value(PILL)));
		let lit: Vec<f32> = motion.lit.iter().map(|tween| tween.value(COLOUR)).collect();
		let view = window.current_view();
		let update = move |change: Box<dyn Fn(&mut Motion) -> bool>| {
			let state = state.clone();
			move |cx: &mut App| {
				if state.update(cx, |motion, _| change(motion)) {
					cx.notify(view);
				}
			}
		};
		let leave = update(Box::new(|motion| motion.hovered.take().is_some()));
		let (muted, full) = (theme::color(theme::TEXT_MUTED), theme::color(theme::TEXT));

		// The pill lives under every label, so it never covers one mid-slide; it shrinks with the
		// item it sits on, about its centre, as the web's pill scales with its item.
		let pill = pill.map(|(on, at)| {
			let share = 1. / count.max(1) as f32;
			// The track less its 1px border and padding on each side.
			let height = f32::from(theme::CONTROL_HEIGHT) - 2. * (1. + TRACK_PADDING);
			div()
				.absolute()
				.bg(theme::color(theme::SECONDARY_HOVER))
				.shadow(key_shadow())
				.with_spring(
					"segmented-pill",
					press_spring(pressed == Some(on)),
					move |pill, scale: f32| {
						let inset = (1. - scale) / 2.;
						pill.top(px(height * inset))
							.bottom(px(height * inset))
							.left(relative((at + inset) * share))
							.w(relative(scale * share))
							// Concentric: the track radius less its border and padding.
							.rounded((theme::RADIUS_CONTROL - px(4.)) * scale)
					},
				)
		});
		let items = self.items.into_iter().enumerate().map(|(ix, label)| {
			let on_pick = self.on_pick.clone();
			let hover = update(Box::new(move |motion| {
				motion.hovered.replace(ix) != Some(ix)
			}));
			let press = update(Box::new(move |motion| {
				motion.pressed.replace(ix) != Some(ix)
			}));
			let release = update(Box::new(|motion| motion.pressed.take().is_some()));
			let release_out = update(Box::new(|motion| motion.pressed.take().is_some()));
			let colour = mix(muted, full, lit.get(ix).copied().unwrap_or(0.));
			div()
				.id(ix)
				.flex_1()
				.h_full()
				.flex()
				.items_center()
				.justify_center()
				.cursor_pointer()
				.font_weight(FontWeight::SEMIBOLD)
				.text_color(colour)
				.child(div().child(label).with_spring(
					("segmented-label", ix),
					press_spring(pressed == Some(ix)),
					|label, scale: f32| label.text_size(theme::TEXT_UI * scale),
				))
				.on_hover(move |hovered, _, cx| {
					if *hovered {
						hover(cx);
					}
				})
				.on_mouse_down(MouseButton::Left, move |_, _, cx| press(cx))
				.on_mouse_up(MouseButton::Left, move |_, _, cx| release(cx))
				.on_mouse_up_out(MouseButton::Left, move |_, _, cx| release_out(cx))
				.on_click(move |_, window, cx| on_pick(&ix, window, cx))
		});

		self.track
			.flex()
			.h(theme::CONTROL_HEIGHT)
			.p(px(TRACK_PADDING))
			.rounded(theme::RADIUS_CONTROL)
			.bg(theme::color(theme::ELEVATED))
			.border_1()
			.border_color(hairline())
			.on_hover(move |hovered, _, cx| {
				if !*hovered {
					leave(cx);
				}
			})
			.child(
				div()
					.relative()
					.size_full()
					.flex()
					.children(pill)
					.children(items),
			)
	}
}
