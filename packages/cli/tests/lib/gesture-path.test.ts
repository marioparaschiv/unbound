import { describe, expect, test } from 'bun:test';

import { gesturePath } from '~/lib/gesture-path';

describe('gesturePath', () => {
	test('splits the drag into evenly timed steps', () => {
		const path = gesturePath({
			x: 10,
			y: 20,
			dx: -90,
			dy: 30,
			duration: 300,
			hold: 0,
			steps: 3,
		});

		expect(path.steps).toEqual([
			{ dx: -30, dy: 10, vx: -300, vy: 100, delay: 100 },
			{ dx: -60, dy: 20, vx: -300, vy: 100, delay: 100 },
			{ dx: -90, dy: 30, vx: -300, vy: 100, delay: 100 },
		]);
		expect(path.release).toEqual({ vx: -300, vy: 100 });
	});

	test('releases still after a hold', () => {
		const path = gesturePath({ x: 0, y: 0, dx: 50, dy: 0, duration: 200, hold: 500, steps: 4 });

		expect(path.hold).toBe(500);
		expect(path.release).toEqual({ vx: 0, vy: 0 });
	});

	test('takes at least one step', () => {
		expect(
			gesturePath({ x: 0, y: 0, dx: 5, dy: 5, duration: 0, hold: 0, steps: 0 }).steps,
		).toHaveLength(1);
	});
});
