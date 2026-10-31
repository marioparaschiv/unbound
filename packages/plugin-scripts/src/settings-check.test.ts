import { describe, expect, test } from 'bun:test';

import type { MeasuredCheck } from './compare-device-matrix';
import { settingsFailure, withSettings } from './settings-check';

const check: MeasuredCheck = {
	id: 'unbound.demo',
	behavior: 'pass',
	lifecycle: 'pass',
	evidence: [],
};

describe('settings check', () => {
	test('passes a screen that rendered text', () => {
		const updated = withSettings(check, 'unbound.demo.settings.png', {
			rendered: true,
			texts: 12,
			error: '',
		});

		expect(updated.behavior).toBe('pass');
		expect(updated.evidence).toEqual(['settings: 12 texts, unbound.demo.settings.png']);
	});

	test('fails a screen that threw, did not render or shows nothing', () => {
		expect(settingsFailure({ rendered: true, texts: 0, error: 'boom' })).toBe(
			'the settings screen threw: boom',
		);
		expect(settingsFailure({ rendered: false, texts: 0, error: '' })).toBe(
			'the settings screen did not render',
		);
		expect(
			withSettings(check, undefined, { rendered: true, texts: 0, error: '' }),
		).toMatchObject({
			behavior: 'fail',
			note: 'the settings screen is empty',
		});
	});
});
