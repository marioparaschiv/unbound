import { describe, expect, test } from 'bun:test';

import { isConflictingTweak, tweakSpans } from '~/lib/debug-card/tweaks';
import { COLORS } from '~/lib/debug-card/spans';

describe('tweakSpans', () => {
	test('shows conflicting tweaks first in red and the rest in yellow', () => {
		const spans = tweakSpans(['Crane', 'Shadow', 'Choicy']);

		expect(spans.map((span) => span.text).join('')).toBe('Shadow · Crane · Choicy');
		expect(spans[0]).toEqual({ text: 'Shadow', color: COLORS.bad });
		expect(spans[2]).toEqual({ text: 'Crane', color: COLORS.warn });
		expect(spans[4]).toEqual({ text: 'Choicy', color: COLORS.warn });
	});

	test('lists every tweak without a count', () => {
		const text = tweakSpans(['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC', 'DDDDDDDDDD'])
			.map((span) => span.text)
			.join('');

		expect(text).toBe('AAAAAAAAAA · BBBBBBBBBB · CCCCCCCCCC · DDDDDDDDDD');
	});

	test('matches conflicts by name regardless of case', () => {
		expect(isConflictingTweak(' shadow ')).toBe(true);
		expect(isConflictingTweak('Choicy')).toBe(false);
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
