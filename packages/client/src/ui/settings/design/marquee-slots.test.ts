import { describe, expect, test } from 'bun:test';

import { SLOT_WIDTH, iconIndex, slotOffset, slotsFor } from './marquee-slots';

const slots = 6;

function offsets(progress: number) {
	return Array.from({ length: slots }, (_, slot) => slotOffset(slot, slots, progress));
}

describe('marquee slots', () => {
	test('the slots tile the row one slot apart, starting one slot off screen', () => {
		expect(offsets(0).sort((a, b) => a - b)).toEqual(
			[-1, 0, 1, 2, 3, 4].map((at) => at * SLOT_WIDTH),
		);
		expect(offsets(2.5).sort((a, b) => a - b)).toEqual(
			[-1.5, -0.5, 0.5, 1.5, 2.5, 3.5].map((at) => at * SLOT_WIDTH),
		);
	});

	test('a slot moves smoothly until it leaves on the left, then re-enters on the right', () => {
		expect(slotOffset(0, slots, 1.9)).toBeCloseTo(-1.9 * SLOT_WIDTH);
		expect(slotOffset(0, slots, 2.1)).toBeCloseTo(3.9 * SLOT_WIDTH);
	});

	test('the slot re-entering on the right shows the next icon in line', () => {
		const shown = (step: number) =>
			Array.from({ length: slots }, (_, slot) => iconIndex(slot, slots, step, 10));

		expect(shown(0)).toEqual([0, 1, 2, 3, 4, 9]);
		expect(shown(1)).toEqual([0, 1, 2, 3, 4, 5]);
		expect(shown(2)).toEqual([6, 1, 2, 3, 4, 5]);
	});

	test('the row repeats seamlessly after slots times icons', () => {
		const loop = slots * 10;

		expect(offsets(loop)).toEqual(offsets(0));

		for (let slot = 0; slot < slots; slot++) {
			expect(iconIndex(slot, slots, loop, 10)).toBe(iconIndex(slot, slots, 0, 10));
		}
	});

	test('a row gets spares beyond its width', () => {
		expect(slotsFor(360)).toBe(8);
	});
});
