//! A value easing between closed (0) and open (1) that can turn back at any moment. A reversal
//! starts from the value on screen and takes the share of the full length left to travel, so
//! nothing jumps when a menu, dialog or toast is reopened mid-close or closed mid-open.

use std::time::{Duration, Instant};

/// How a [`Transition`] moves: each direction's full length and the curve both run on.
#[derive(Clone, Copy)]
pub struct Timing {
	pub open: Duration,
	pub close: Duration,
	pub ease: fn(f32) -> f32,
}

impl Timing {
	fn length(&self, open: bool) -> Duration {
		if open { self.open } else { self.close }
	}
}

/// Where a transition is heading, the value it left from, and when.
#[derive(Clone, Copy, Debug)]
pub struct Transition {
	open: bool,
	from: f32,
	at: Instant,
}

impl Default for Transition {
	/// Closed and settled.
	fn default() -> Self {
		Self {
			open: false,
			from: 0.,
			at: Instant::now(),
		}
	}
}

impl Transition {
	/// Starts opening from closed now.
	pub fn opening() -> Self {
		Self::toward(true)
	}

	/// Starts from the far end now, heading `open` or closed.
	pub fn toward(open: bool) -> Self {
		Self {
			open,
			from: f32::from(u8::from(!open)),
			at: Instant::now(),
		}
	}

	pub fn is_open(&self) -> bool {
		self.open
	}

	fn target(&self) -> f32 {
		f32::from(u8::from(self.open))
	}

	/// The time this leg takes: its direction's length scaled by the distance it covers.
	fn leg(&self, timing: Timing) -> Duration {
		timing
			.length(self.open)
			.mul_f32((self.target() - self.from).abs())
	}

	fn progress(&self, timing: Timing) -> f32 {
		let leg = self.leg(timing);
		if leg.is_zero() {
			return 1.;
		}
		(self.at.elapsed().as_secs_f32() / leg.as_secs_f32()).min(1.)
	}

	/// How far open it is now, 0 to 1; a curve that overshoots may pass 1 briefly.
	pub fn value(&self, timing: Timing) -> f32 {
		let target = self.target();
		self.from + (target - self.from) * (timing.ease)(self.progress(timing))
	}

	pub fn is_moving(&self, timing: Timing) -> bool {
		self.progress(timing) < 1.
	}

	/// How long until it settles.
	pub fn remaining(&self, timing: Timing) -> Duration {
		self.leg(timing).saturating_sub(self.at.elapsed())
	}

	/// Opens or closes it from wherever it is now; asking for the way it already goes does nothing.
	pub fn set(&mut self, open: bool, timing: Timing) {
		if open == self.open {
			return;
		}
		let from = self.value(timing).clamp(0., 1.);
		*self = Self {
			open,
			from,
			at: Instant::now(),
		};
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	const LINEAR: Timing = Timing {
		open: Duration::from_secs(1),
		close: Duration::from_secs(1),
		ease: |t| t,
	};

	#[test]
	fn a_reversal_turns_back_from_where_it_is() {
		let mut transition = Transition {
			open: true,
			from: 0.,
			at: Instant::now() - Duration::from_millis(400),
		};
		let before = transition.value(LINEAR);
		transition.set(false, LINEAR);
		assert!((transition.value(LINEAR) - before).abs() < 0.01);
		// Only the distance back is left to travel.
		assert!(transition.remaining(LINEAR) <= Duration::from_millis(410));
	}

	#[test]
	fn a_settled_transition_rests_at_its_end() {
		let closed = Transition::default();
		assert_eq!(closed.value(LINEAR), 0.);
		assert!(!closed.is_moving(LINEAR));
		let mut open = Transition::opening();
		assert!(open.is_moving(LINEAR));
		open.set(true, LINEAR);
		assert!(open.value(LINEAR) < 0.1);
	}
}
