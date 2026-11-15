import { describe, expect, test } from 'bun:test';

import { COLORS } from '~/lib/debug-card/spans';
import { isConflictingTweak, tweakSpans } from '~/lib/debug-card/tweaks';

describe('tweakSpans', () => {
	test('shows conflicting tweaks first in red and the rest in yellow', () => {
		const spans = tweakSpans(['Crane', 'Choicy', 'ColorMyBattery'], 42);

		expect(spans.map((span) => span.text).join('')).toBe('Choicy · Crane · ColorMyBattery');
		expect(spans[0]).toEqual({ text: 'Choicy', color: COLORS.bad });
		expect(spans[2]).toEqual({ text: 'Crane', color: COLORS.warn });
	});

	test('fits the room with a count of the rest', () => {
		const text = tweakSpans(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC', 'DDDDDDDDDD'], 30)
			.map((span) => span.text)
			.join('');

		expect(text.length).toBeLessThanOrEqual(30);
		expect(text).toContain('more');
	});

	test('matches conflicts by name regardless of case', () => {
		expect(isConflictingTweak(' choicy ')).toBe(true);
		expect(isConflictingTweak('Crane')).toBe(false);
	});
});

describe('accountNotes', () => {
	test('notes a new or unverified account and stays quiet for an established one', async () => {
		const { accountNotes } = await import('~/lib/debug-card/account');

		expect(accountNotes({ ageDays: 3, mfa: false, phone: false, email: true })).toEqual([
			'new (3 d)',
			'no 2FA',
			'no phone',
		]);
		expect(accountNotes({ ageDays: 3000, mfa: true, phone: true, email: true })).toEqual([]);
		expect(accountNotes(undefined)).toEqual([]);
	});
});
