//! Base UI's popover motion (its docs' `.Popup`): opacity 0 and `scale(0.98)` at the starting
//! and ending style, `transition: transform 100ms ease-out, opacity 100ms ease-out`, about
//! `--transform-origin`. gpui has no transforms, so callers draw every length at [`Frame::scale`]
//! and pin the popout's origin themselves.

use std::time::Duration;

use gpui::Window;

use crate::easing::cubic_bezier;
use crate::transition::{Timing, Transition};

/// Both ways run CSS's `ease-out`, `cubic-bezier(0, 0, 0.58, 1)`, toward their own end.
const TIMING: Timing = Timing {
	open: Duration::from_millis(100),
	close: Duration::from_millis(100),
	ease: |t| cubic_bezier([0., 0., 0.58, 1.], t),
};
/// Base UI's `[data-starting-style]` and `[data-ending-style]` scale.
const FROM_SCALE: f32 = 0.98;

/// Whether a popout is open, and its motion; a reversal mid-way turns back from where it is.
#[derive(Clone, Copy, Default)]
pub struct Popout(Transition);

/// One frame of the motion.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Frame {
	pub opacity: f32,
	pub scale: f32,
}

impl Popout {
	pub fn is_open(&self) -> bool {
		self.0.is_open()
	}

	pub fn set(&mut self, open: bool) {
		self.0.set(open, TIMING);
	}

	/// This frame's look, or `None` when closed and settled, so there is nothing to draw. Asks for
	/// another frame while it moves.
	pub fn frame(&mut self, window: &mut Window) -> Option<Frame> {
		let moving = self.0.is_moving(TIMING);
		if moving {
			window.request_animation_frame();
		}
		if !self.is_open() && !moving {
			return None;
		}
		Some(frame_at(self.0.value(TIMING)))
	}
}

fn frame_at(shown: f32) -> Frame {
	Frame {
		opacity: shown,
		scale: FROM_SCALE + (1. - FROM_SCALE) * shown,
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn opens_from_faded_and_small() {
		assert_eq!(
			frame_at(0.),
			Frame {
				opacity: 0.,
				scale: FROM_SCALE
			}
		);
		assert_eq!(
			frame_at(1.),
			Frame {
				opacity: 1.,
				scale: 1.
			}
		);
	}

	#[test]
	fn a_closed_popout_starts_settled() {
		let popout = Popout::default();
		assert!(!popout.is_open());
		assert_eq!(popout.0.value(TIMING), 0.);
	}
}
