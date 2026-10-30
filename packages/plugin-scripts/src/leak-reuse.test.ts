import { describe, expect, test } from 'bun:test';

import type { MeasuredCheck } from './compare-device-matrix';
import { reusableLeak } from './leak-reuse';

const check = (bundleHash?: string, leakPerCycleMB?: number): MeasuredCheck => ({
	id: 'unbound.demo',
	behavior: 'pass',
	lifecycle: 'pass',
	evidence: [],
	...(bundleHash ? { bundleHash } : {}),
	...(leakPerCycleMB === undefined ? {} : { leakPerCycleMB }),
});

describe('leak reuse', () => {
	test('keeps the last result for the same bundle', () => {
		expect(reusableLeak(check('a'), [check('a', 0.04)])).toBe(0.04);
	});

	test('measures again when the bundle changed or was never measured', () => {
		expect(reusableLeak(check('b'), [check('a', 0.04)])).toBeUndefined();
		expect(reusableLeak(check('a'), [check('a')])).toBeUndefined();
		expect(reusableLeak(check(), [check(undefined, 0.04)])).toBeUndefined();
		expect(reusableLeak(check('a'), undefined)).toBeUndefined();
	});
});
