import { describe, expect, test } from 'bun:test';

import type { MeasuredCheck } from './compare-device-matrix';
import { reusableLeak, reusableSettings } from './run-reuse';

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

describe('settings reuse', () => {
	const passed = { ...check('a'), evidence: ['settings: 12 texts, unbound.demo.settings.png'] };

	test('keeps a passing settings check for the same bundle', () => {
		expect(reusableSettings('unbound.demo', 'a', [passed])).toBe(
			'settings: 12 texts, unbound.demo.settings.png',
		);
	});

	test('checks again after a change or a visual problem', () => {
		expect(reusableSettings('unbound.demo', 'b', [passed])).toBeUndefined();
		expect(
			reusableSettings('unbound.demo', 'a', [
				{ ...passed, visualProblems: ['the settings screen is empty'] },
			]),
		).toBeUndefined();
		expect(reusableSettings('unbound.demo', 'a', [check('a')])).toBeUndefined();
	});
});
