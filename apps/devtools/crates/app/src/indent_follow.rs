//! Keeps a deep tree's rows in view as it scrolls: the indentation of every row shifts left by
//! however many levels the rows on screen need to fit the panel, and glides there on a spring, so
//! scrolling down into a deep subtree carries its rows back toward the middle instead of off the
//! right edge.

use std::ops::Range;
use std::time::Instant;

use gpui::{App, SpringConfig, SpringState, UniformListScrollHandle, Window};
use gpui_component::scroll::ScrollbarHandle;

use crate::theme;

/// Critically damped (`2 * sqrt(300)`): a shift lands in about 250ms without swinging past.
const SPRING: SpringConfig = SpringConfig::new(300., 34.64, 1.);
/// How close, in levels, a glide must be to its target to stop.
const SETTLED: f32 = 0.01;
/// Room kept right of the deepest row's indent for its name and badges.
const NAME_ROOM: f32 = 280.;
/// A narrow panel still shows this many levels of indentation.
const MIN_LEVELS: f32 = 4.;

/// @description The levels to shift so rows `shallowest..=deepest` levels deep fit `fits` levels.
/// @param fits How many levels of indentation the panel shows beside a name.
/// @returns Zero while the deepest row fits; otherwise just enough to fit it, or, when the rows
/// in view span more levels than fit, the shift that centres them.
pub fn target_shift(shallowest: u32, deepest: u32, fits: u32) -> u32 {
	if deepest - shallowest <= fits {
		deepest.saturating_sub(fits)
	} else {
		(shallowest + deepest - fits) / 2
	}
}

/// How many levels a panel `width` wide fits beside a name.
fn fits(width: f32) -> u32 {
	((width - 2. * theme::INSET - NAME_ROOM) / theme::INDENT).max(MIN_LEVELS) as u32
}

/// The rows of a uniform list of `count` rows, each `row_height` tall under `top` padding, that
/// its viewport shows.
fn visible_rows(
	scroll: &UniformListScrollHandle,
	count: usize,
	row_height: f32,
	top: f32,
) -> Range<usize> {
	let viewport = scroll.viewport_bounds().size.height.as_f32();
	let scrolled = -scroll.offset().y.as_f32() - top;
	let first = (scrolled / row_height).floor().max(0.) as usize;
	let last = ((scrolled + viewport) / row_height).ceil().max(0.) as usize;
	first.min(count)..last.min(count)
}

/// The shift a tree's rows are drawn at, gliding toward the one its rows in view need.
#[derive(Default)]
pub struct IndentFollow {
	/// `None` until the first rows are seen, so a tree opens at its shift without gliding.
	spring: Option<SpringState>,
	target: f32,
	/// When the glide last stepped; `None` while settled, so the next glide starts from rest.
	stepped: Option<Instant>,
}

impl IndentFollow {
	/// The shift for this frame, in levels, which may be fractional mid-glide.
	pub fn shift(&self) -> f32 {
		self.spring.map_or(0., |spring| spring.position)
	}

	/// Aims at the shift the rows on screen need and steps the glide, asking for another frame
	/// while it moves. `depth` gives row `ix`'s level.
	pub fn follow(
		&mut self,
		scroll: &UniformListScrollHandle,
		count: usize,
		top: f32,
		depth: impl Fn(usize) -> u32,
		window: &mut Window,
		cx: &App,
	) {
		let rows = visible_rows(scroll, count, theme::ROW_HEIGHT.as_f32(), top);
		let depths = rows.map(depth);
		let Some((shallowest, deepest)) = depths.fold(None, |span, depth| match span {
			None => Some((depth, depth)),
			Some((low, high)) => Some((depth.min(low), depth.max(high))),
		}) else {
			return;
		};
		let width = scroll.viewport_bounds().size.width.as_f32();
		self.target = target_shift(shallowest, deepest, fits(width)) as f32;
		let Some(spring) = self.spring.filter(|_| !cx.reduce_motion()) else {
			self.spring = Some(SpringState {
				position: self.target,
				velocity: 0.,
			});
			return;
		};
		let now = Instant::now();
		let elapsed = self
			.stepped
			.replace(now)
			.map_or(0., |at| now.saturating_duration_since(at).as_secs_f32());
		let spring = SPRING.step(spring, self.target, elapsed);
		if SPRING.is_settled(spring, self.target, SETTLED) {
			self.spring = Some(SpringState {
				position: self.target,
				velocity: 0.,
			});
			self.stepped = None;
		} else {
			self.spring = Some(spring);
			window.request_animation_frame();
		}
	}
}

/// @description The left edge of a tree guide at `level`, for rows drawn at `shift`.
/// @returns Pixels from the row's left edge; negative once the level has shifted out of view.
pub fn guide_left(level: u32, shift: f32) -> f32 {
	theme::INSET + (level as f32 - shift) * theme::INDENT + theme::INDENT / 2.
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn rows_that_fit_stay_where_they_are() {
		assert_eq!(target_shift(0, 10, 12), 0);
		assert_eq!(target_shift(8, 12, 12), 0);
	}

	#[test]
	fn deep_rows_shift_just_enough_to_fit() {
		assert_eq!(target_shift(30, 40, 12), 28);
	}

	#[test]
	fn rows_spanning_more_than_fit_are_centred() {
		// Levels 10 to 40 are 30 deep; 12 fit, so the middle twelve (19 to 31) show.
		assert_eq!(target_shift(10, 40, 12), 19);
	}

	#[test]
	fn a_narrow_panel_keeps_a_few_levels() {
		assert_eq!(fits(0.), MIN_LEVELS as u32);
		assert!(fits(800.) > fits(400.));
	}
}
