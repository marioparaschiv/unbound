import { describe, expect, test } from 'bun:test';

import { matchingPreset, PRESETS } from '~/presets';
import { settings } from '@unbound-app/settings';

describe('presets', () => {
	test('finds the preset whose look is set', () => {
		const look: Record<string, unknown> = { ...PRESETS.joined };

		expect(matchingPreset((key) => look[key])).toBe('joined');
	});

	test('finds none once a setting differs', () => {
		const look: Record<string, unknown> = { ...PRESETS.joined, radius: 17 };

		expect(matchingPreset((key) => look[key])).toBeUndefined();
	});

	test('keeps the messages preset on the defaults', () => {
		expect(matchingPreset((key) => settings[key])).toBe('messages');
	});
});
