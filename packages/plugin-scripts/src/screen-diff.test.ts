import { describe, expect, test } from 'bun:test';

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	describeScreenChange,
	differenceRatio,
	keepGoodScreens,
	referenceFor,
} from './screen-diff';

describe('screen changes', () => {
	test('reads the share ImageMagick prints', () => {
		expect(differenceRatio('441 (0.049)')).toBe(0.049);
		expect(differenceRatio('0 (0)')).toBe(0);
		expect(differenceRatio('compare: images differ in size')).toBeUndefined();
	});

	test('reports only changes large enough to look at', () => {
		expect(describeScreenChange('unbound.demo settings', 0.001)).toBeUndefined();
		expect(describeScreenChange('unbound.demo settings', undefined)).toBeUndefined();
		expect(describeScreenChange('unbound.demo settings', 0.12)).toBe(
			'unbound.demo settings screen looks different from the last run (12.0% of pixels)',
		);
	});
});

describe('reference screenshots', () => {
	test('prefers the last good run over the last run', () => {
		const out = mkdtempSync(join(tmpdir(), 'matrix-screens-'));
		const file = join(out, 'unbound.demo.settings.png');

		writeFileSync(file, 'last run');
		expect(referenceFor(file)).toBe(join(out, 'previous', 'unbound.demo.settings.png'));

		expect(keepGoodScreens(out, '.settings.png')).toBe(1);
		writeFileSync(file, 'failed run');
		expect(referenceFor(file)).toBe(join(out, 'good', 'unbound.demo.settings.png'));
		expect(readFileSync(join(out, 'good', 'unbound.demo.settings.png'), 'utf8')).toBe(
			'last run',
		);

		rmSync(out, { recursive: true, force: true });
	});
});
