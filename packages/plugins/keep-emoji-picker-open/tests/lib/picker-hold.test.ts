import { describe, expect, test } from 'bun:test';

import { createPickerHold, PICKER_KEY } from '~/lib/picker-hold';

function clock() {
	let time = 1000;

	return { now: () => time, advance: (ms: number) => (time += ms) };
}

describe('createPickerHold', () => {
	test('holds nothing before a pick', () => {
		const { now } = clock();

		expect(createPickerHold(600, now).holds(PICKER_KEY)).toBe(false);
	});

	test('holds the picker and keyless closes right after a pick', () => {
		const { now, advance } = clock();
		const hold = createPickerHold(600, now);

		hold.hold();
		advance(420);

		expect(hold.holds(PICKER_KEY)).toBe(true);
		expect(hold.holds()).toBe(true);
	});

	test('never holds other sheets', () => {
		const { now } = clock();
		const hold = createPickerHold(600, now);

		hold.hold();

		expect(hold.holds('MessageLongPressActionSheet')).toBe(false);
	});

	test('lets the picker close once the moment passes', () => {
		const { now, advance } = clock();
		const hold = createPickerHold(600, now);

		hold.hold();
		advance(600);

		expect(hold.holds(PICKER_KEY)).toBe(false);
	});
});
