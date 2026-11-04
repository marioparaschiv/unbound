import { describe, expect, test } from 'bun:test';

import {
	createDrawnSignatures,
	needsSettle,
	noteChange,
	notePlaced,
	startSettle,
} from '~/reuse-settle';

describe('reuse settle', () => {
	test('settles a reused cell that was never placed', () => {
		expect(needsSettle(startSettle())).toBe(true);
	});

	test('skips the settle pass after a clean place', () => {
		const settle = startSettle();

		notePlaced(settle);

		expect(needsSettle(settle)).toBe(false);
	});

	test('settles again when the cell changes after it was placed', () => {
		const settle = startSettle();

		notePlaced(settle);

		expect(noteChange(settle)).toBe(false);
		expect(needsSettle(settle)).toBe(true);
	});

	test('a later place covers the earlier change', () => {
		const settle = startSettle();

		notePlaced(settle);
		noteChange(settle);
		notePlaced(settle);

		expect(needsSettle(settle)).toBe(false);
	});

	test('a change before the first place leaves the settle pass to place it', () => {
		const settle = startSettle();

		expect(noteChange(settle)).toBe(false);
		expect(settle.dirty).toBe(false);
		expect(needsSettle(settle)).toBe(true);
	});

	test('asks to place a changed cell that is not settling', () => {
		expect(noteChange(undefined)).toBe(true);
	});
});

describe('drawn signatures', () => {
	const drawn = { x: 1, y: 2, width: 3, height: 4, radius: 12, color: '#fff' };

	test('skips an identical redraw', () => {
		const signatures = createDrawnSignatures();

		expect(signatures.changed('a', drawn)).toBe(true);
		expect(signatures.changed('a', { ...drawn })).toBe(false);
	});

	test('redraws when the frame or color changes', () => {
		const signatures = createDrawnSignatures();

		signatures.changed('a', drawn);

		expect(signatures.changed('a', { ...drawn, height: 5 })).toBe(true);
		expect(signatures.changed('a', { ...drawn, height: 5, color: '#000' })).toBe(true);
	});

	test('redraws after the cell is forgotten or everything is cleared', () => {
		const signatures = createDrawnSignatures();

		signatures.changed('a', drawn);
		signatures.forget('a');

		expect(signatures.changed('a', drawn)).toBe(true);

		signatures.clear();

		expect(signatures.changed('a', drawn)).toBe(true);
	});
});
