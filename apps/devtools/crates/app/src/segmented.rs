//! The web's Segmented control (`apps/web/src/components/ui/segmented.tsx`): items as wide as their
//! labels plus even padding on a ringed track, and one raised pill under the hovered item, or the
//! chosen one at rest. The pill slides and resizes between items, labels fade their colour, and a
//! pressed item's pill shrinks like `.press-flat` under its still label.

use std::rc::Rc;
use std::time::{Duration, Instant};

use gpui::prelude::FluentBuilder;
use gpui::{
	AnimationExt, App, Div, ElementId, FontWeight, InteractiveElement, IntoElement, MouseButton,
	ParentElement, RenderOnce, Rgba, SharedString, SpringAnimation, Stateful,
	StatefulInteractiveElement, StyleRefinement, Styled, TextRun, Window, div, font, px,
};

use crate::easing::cubic_bezier;
use crate::press::{FLAT_SCALE, PRESS, RELEASE};
use crate::theme;
use crate::widgets::{hairline, key_shadow};

const TRACK_PADDING: f32 = 3.;
/// The web's `px-3.5` on each item, either side of its label.
const ITEM_PADDING: f32 = 14.;
/// The web's `gap-0.5` between items.
const GAP: f32 = 2.;

/// How wide an item showing `label` is: its label in the control's semibold UI font, padded.
fn item_width(window: &Window, label: &SharedString) -> f32 {
	let run = TextRun {
		len: label.len(),
		font: gpui::Font {
			weight: FontWeight::SEMIBOLD,
			..font(theme::ui_font())
		},
		color: theme::hsla(theme::TEXT),
		background_color: None,
		underline: None,
		strikethrough: None,
	};
	let text = window
		.text_system()
		.shape_line(label.clone(), theme::TEXT_UI, &[run], None)
		.width();
	// Rounded up, so the label never wraps or clips inside the width it was measured at.
	f32::from(text).ceil() + 2. * ITEM_PADDING
}

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

/// Where an item sits on the track, in pixels from the track's inner left edge.
#[derive(Clone, Copy, PartialEq)]
struct Span {
	left: f32,
	width: f32,
}

/// Lays items of `widths` out side by side, [`GAP`] apart.
fn spans(widths: &[f32]) -> Vec<Span> {
	let mut left = 0.;
	widths
		.iter()
		.map(|width| {
			let span = Span {
				left,
				width: *width,
			};
			left += width + GAP;
			span
		})
		.collect()
}

/// The pill: the item it is heading for, and its left edge and width easing there. Both edges
/// move on one curve, as the web animates the pill's insets.
#[derive(Clone, Copy)]
struct Pill {
	on: usize,
	left: Tween,
	width: Tween,
}

impl Pill {
	fn at(on: usize, span: Span) -> Self {
		Self {
			on,
			left: Tween::still(span.left),
			width: Tween::still(span.width),
		}
	}

	/// Slides to item `on`; a new span for the same item, from a resize, is taken at once.
	fn retarget(&mut self, on: usize, span: Span, reduce_motion: bool) {
		let snap = reduce_motion || on == self.on;
		self.on = on;
		self.left.retarget(span.left, PILL, snap);
		self.width.retarget(span.width, PILL, snap);
	}

	fn span(&self) -> Span {
		Span {
			left: self.left.value(PILL),
			width: self.width.value(PILL),
		}
	}

	fn moving(&self) -> bool {
		self.left.moving(PILL) || self.width.moving(PILL)
	}
}

/// What the mouse is doing to the control, and where its pill and label colours are heading.
#[derive(Default)]
struct Motion {
	hovered: Option<usize>,
	pressed: Option<usize>,
	/// `None` while nothing is hovered or chosen.
	pill: Option<Pill>,
	/// Each label's colour, 0 muted to 1 full.
	lit: Vec<Tween>,
	/// A filling control's items as last laid out; their widths are only known after layout.
	laid_out: Vec<Span>,
}

impl Motion {
	/// Points the pill and labels at the current hover and choice; returns whether any still moves.
	/// `spans` is empty while a filling control waits for its first layout.
	fn retarget(
		&mut self,
		count: usize,
		spans: &[Span],
		selected: Option<usize>,
		reduce_motion: bool,
	) -> bool {
		self.hovered = self.hovered.filter(|ix| *ix < count);
		let target = self.hovered.or(selected).filter(|ix| *ix < spans.len());
		let lit = |ix: usize| f32::from(u8::from(selected == Some(ix) || self.hovered == Some(ix)));
		// A pill with nowhere to slide from appears in place, as on the web.
		self.pill = target.map(|ix| {
			let mut pill = self.pill.unwrap_or(Pill::at(ix, spans[ix]));
			pill.retarget(ix, spans[ix], reduce_motion);
			pill
		});
		if self.lit.len() != count {
			self.lit = (0..count).map(|ix| Tween::still(lit(ix))).collect();
		}
		let targets: Vec<f32> = (0..count).map(lit).collect();
		for (tween, to) in self.lit.iter_mut().zip(targets) {
			tween.retarget(to, COLOUR, reduce_motion);
		}
		self.pill.is_some_and(|pill| pill.moving())
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
	fill: bool,
}

/// @description The web's Segmented control: label-sized items on a ringed track with a sliding pill.
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
		fill: false,
	}
}

impl Segmented {
	/// Stretches the control across its parent, split into equal items; none narrower than its
	/// padded label.
	pub fn fill(mut self) -> Self {
		self.fill = true;
		self
	}
}

impl Styled for Segmented {
	fn style(&mut self) -> &mut StyleRefinement {
		self.track.style()
	}
}

impl RenderOnce for Segmented {
	fn render(self, window: &mut Window, cx: &mut App) -> impl IntoElement {
		let widths: Vec<f32> = self
			.items
			.iter()
			.map(|label| item_width(window, label))
			.collect();
		let fill = self.fill;
		let count = widths.len();
		let reduce_motion = cx.reduce_motion();
		let state = window.use_keyed_state(self.id.clone(), cx, |_, _| Motion::default());
		let moving = state.update(cx, |motion, _| {
			let layout = if !fill {
				spans(&widths)
			} else if motion.laid_out.len() == count {
				motion.laid_out.clone()
			} else {
				// Not laid out yet, or the items changed: no pill until the next layout.
				Vec::new()
			};
			motion.retarget(count, &layout, self.selected, reduce_motion)
		});
		if moving {
			window.request_animation_frame();
		}
		let motion = state.read(cx);
		let pressed = motion.pressed;
		let pill = motion.pill.map(|pill| (pill.on, pill.span()));
		let lit: Vec<f32> = motion.lit.iter().map(|tween| tween.value(COLOUR)).collect();
		let view = window.current_view();
		let laid_out_state = state.clone();
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
		let pill = pill.map(|(on, span)| {
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
							.left(px(span.left + span.width * inset))
							.w(px(span.width * scale))
							// Concentric: the track radius less its border and padding.
							.rounded((theme::RADIUS_CONTROL - px(4.)) * scale)
					},
				)
		});
		let items = self
			.items
			.into_iter()
			.zip(widths)
			.enumerate()
			.map(|(ix, (label, width))| {
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
					.map(|item| {
						if fill {
							item.flex_1().min_w(px(width))
						} else {
							item.flex_none().w(px(width))
						}
					})
					.h_full()
					.flex()
					.items_center()
					.justify_center()
					.cursor_pointer()
					.font_weight(FontWeight::SEMIBOLD)
					.text_size(theme::TEXT_UI)
					.text_color(colour)
					.child(label)
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

		let inner = div()
			.relative()
			.h_full()
			.when(fill, |inner| inner.w_full())
			.flex()
			.gap(px(GAP))
			.children(pill)
			.children(items)
			// A filling control's items are as wide as layout makes them: keep their spans for the
			// pill, and redraw when they change.
			.when(fill, |inner| {
				inner.on_children_prepainted(move |bounds, _, cx| {
					let items = &bounds[bounds.len().saturating_sub(count)..];
					let Some(origin) = items.first().map(|item| item.origin.x) else {
						return;
					};
					let laid_out: Vec<Span> = items
						.iter()
						.map(|item| Span {
							left: f32::from(item.origin.x - origin),
							width: f32::from(item.size.width),
						})
						.collect();
					let changed = laid_out_state.update(cx, |motion, _| {
						let changed = motion.laid_out != laid_out;
						motion.laid_out = laid_out;
						changed
					});
					if changed {
						cx.notify(view);
					}
				})
			});

		self.track
			.when(!fill, |track| track.flex_none())
			.flex()
			.h(theme::CONTROL_HEIGHT)
			.font_family(theme::ui_font())
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
			.child(inner)
	}
}
