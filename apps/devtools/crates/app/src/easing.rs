//! CSS timing curves, for animations that must match the web's.

/// @description CSS's `cubic-bezier(x1, y1, x2, y2)` at `t`, clamped to 0..1.
pub fn cubic_bezier([x1, y1, x2, y2]: [f32; 4], t: f32) -> f32 {
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
		if bezier(x1, x2, mid) < t {
			low = mid;
		} else {
			high = mid;
		}
	}
	bezier(y1, y2, (low + high) / 2.)
}

#[cfg(test)]
mod tests {
	use super::*;

	#[test]
	fn linear_curve_is_identity_and_ends_are_pinned() {
		let linear = [0., 0., 1., 1.];
		for t in [0.1, 0.5, 0.9] {
			assert!((cubic_bezier(linear, t) - t).abs() < 1e-4);
		}
		assert_eq!(cubic_bezier([0.23, 1., 0.32, 1.], 0.), 0.);
		assert_eq!(cubic_bezier([0.23, 1., 0.32, 1.], 1.), 1.);
	}

	#[test]
	fn ease_out_front_loads_the_distance() {
		assert!(cubic_bezier([0.23, 1., 0.32, 1.], 0.25) > 0.75);
	}
}
