//! Base UI's popover motion (its docs' `.Popup`): opacity 0 and `scale(0.98)` at the starting
//! and ending style, `transition: transform 100ms ease-out, opacity 100ms ease-out`, about
//! `--transform-origin`. gpui has no transforms, so callers draw every length at [`Frame::scale`]
//! and pin the popout's origin themselves.

use std::time::{Duration, Instant};

use gpui::Window;

const DURATION: Duration = Duration::from_millis(100);
/// Base UI's `[data-starting-style]` and `[data-ending-style]` scale.
const FROM_SCALE: f32 = 0.98;

/// Whether a popout is open, and where its motion started.
#[derive(Clone, Copy, Default)]
pub struct Popout {
	open: bool,
	/// The linear progress when the motion started and when; `None` once settled.
	moved: Option<(f32, Instant)>,
}

/// One frame of the motion.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
	pub opacity: f32,
	pub scale: f32,
}

impl Popout {
	pub fn is_open(&self) -> bool {
		self.open
	}

	/// Opens or closes it; a reversal mid-motion turns back from where it is, as a CSS transition does.
	pub fn set(&mut self, open: bool) {
		if open == self.open {
			return;
		}
		let at = self.linear();
		self.open = open;
		self.moved = Some((at, Instant::now()));
	}

	/// Linear progress, 0 closed to 1 open.
	fn linear(&self) -> f32 {
		let target = if self.open { 1. } else { 0. };
		let Some((from, since)) = self.moved else {
			return target;
		};
		let step = since.elapsed().as_secs_f32() / DURATION.as_secs_f32();
		if self.open {
			(from + step).min(1.)
		} else {
			(from - step).max(0.)
		}
	}

	/// This frame's look, or `None` when closed and settled, so there is nothing to draw. Asks for
	/// another frame while it moves.
	pub fn frame(&mut self, window: &mut Window) -> Option<Frame> {
		let linear = self.linear();
		let settled = linear == if self.open { 1. } else { 0. };
		if settled {
			self.moved = None;
		} else {
			window.request_animation_frame();
		}
		if !self.open && settled {
			return None;
		}
		Some(frame_at(linear, self.open))
	}
}

/// Opening eases toward open; closing eases toward closed, as each CSS transition runs ease-out
/// toward its own end.
fn frame_at(linear: f32, opening: bool) -> Frame {
	let shown = if opening {
		ease_out(linear)
	} else {
		1. - ease_out(1. - linear)
	};
	Frame {
		opacity: shown,
		scale: FROM_SCALE + (1. - FROM_SCALE) * shown,
	}
}

/// CSS's `ease-out`, `cubic-bezier(0, 0, 0.58, 1)`.
fn ease_out(t: f32) -> f32 {
	if t <= 0. || t >= 1. {
		return t.clamp(0., 1.);
	}
	let bezier = |a: f32, b: f32, u: f32| {
		3. * a * u * (1. - u).powi(2) + 3. * b * u * u * (1. - u) + u.powi(3)
	};
	// Bisect for the curve parameter whose x is `t`; 20 steps is far below a pixel.
	let (mut low, mut high) = (0_f32, 1_f32);
	for _ in 0..20 {
		let mid = (low + high) / 2.;
		if bezier(0., 0.58, mid) < t {
			low = mid;
		} else {
			high = mid;
		}
	}
	bezier(0., 1., (low + high) / 2.)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn opens_from_faded_and_small() {
		assert_eq!(
			frame_at(0., true),
			Frame {
				opacity: 0.,
				scale: FROM_SCALE
			}
		);
		assert_eq!(
			frame_at(1., true),
			Frame {
				opacity: 1.,
				scale: 1.
			}
		);
	}

	#[test]
	fn closing_eases_out_toward_closed() {
		// Ease-out moves fastest at its start, so a closing popout loses most of its opacity early.
		assert!(frame_at(0.75, false).opacity < 0.75);
		assert!(frame_at(0.25, true).opacity > 0.25);
	}

	#[test]
	fn eases_without_overshoot() {
		let samples: Vec<f32> = (0..=20).map(|step| ease_out(step as f32 / 20.)).collect();
		assert!(samples.windows(2).all(|pair| pair[0] <= pair[1]));
		assert!(samples.iter().all(|value| (0. ..=1.0001).contains(value)));
	}

	#[test]
	fn a_closed_popout_starts_settled() {
		let popout = Popout::default();
		assert!(!popout.is_open());
		assert_eq!(popout.linear(), 0.);
	}
}
