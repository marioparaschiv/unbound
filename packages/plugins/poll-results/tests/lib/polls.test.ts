import { describe, expect, test } from 'bun:test';

import { hidesResults } from '~/lib/polls';

const now = Date.parse('2026-11-17T12:00:00Z');
const open = {
	id: '1',
	poll: { expiry: '2026-11-18T12:00:00Z', results: { answer_counts: [{ me_voted: false }] } },
};

describe('hidesResults', () => {
	test('is true for an open poll you have not voted in', () => {
		expect(hidesResults(open, now)).toBe(true);
		expect(hidesResults({ id: '2', poll: { expiry: null, results: null } }, now)).toBe(true);
	});

	test('is false once you voted, the poll ended, or there is no poll', () => {
		expect(
			hidesResults(
				{
					id: '1',
					poll: { ...open.poll, results: { answer_counts: [{ me_voted: true }] } },
				},
				now,
			),
		).toBe(false);
		expect(
			hidesResults({ id: '1', poll: { ...open.poll, expiry: '2026-11-17T11:00:00Z' } }, now),
		).toBe(false);
		expect(
			hidesResults({ id: '1', poll: { ...open.poll, results: { is_finalized: true } } }, now),
		).toBe(false);
		expect(hidesResults({ id: '1' }, now)).toBe(false);
	});
});
