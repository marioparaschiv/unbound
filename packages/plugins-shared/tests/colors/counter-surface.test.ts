import { describe, expect, test } from 'bun:test';

import { counterSurface } from '~/colors/counter-surface';

describe('counterSurface', () => {
	test('chooses a subtle surface against dark and light theme text', () => {
		expect(counterSurface('#f2f3f5')).toBe('rgba(255, 255, 255, 0.12)');
		expect(counterSurface('rgb(49, 51, 56)')).toBe('rgba(0, 0, 0, 0.08)');
		expect(counterSurface('#313338')).toBe('rgba(0, 0, 0, 0.08)');
	});

	test('falls back to the light tint for colors it cannot read', () => {
		expect(counterSurface(undefined)).toBe('rgba(255, 255, 255, 0.12)');
		expect(counterSurface('hsl(0, 0%, 0%)')).toBe('rgba(255, 255, 255, 0.12)');
		expect(counterSurface({ category: 'semantic' })).toBe('rgba(255, 255, 255, 0.12)');
	});
});
