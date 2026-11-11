import { describe, expect, test } from 'bun:test';

import { statusColor } from '~/lib/status-colors';

describe('statusColor', () => {
	test("uses the theme's color for the status", () => {
		const tokens: string[] = [];
		const color = statusColor('idle', (token) => {
			tokens.push(token);

			return '#abcdef';
		});

		expect(color).toBe('#abcdef');
		expect(tokens).toEqual(['STATUS_IDLE']);
	});

	test('falls back to Discord colors when the theme cannot resolve', () => {
		expect(statusColor('online', () => undefined)).toBe('#23a55a');
		expect(statusColor('dnd', () => '')).toBe('#f23f43');
	});

	test('reads an unknown status as offline', () => {
		const tokens: string[] = [];

		expect(
			statusColor('invisible', (token) => {
				tokens.push(token);
			}),
		).toBe('#80848e');
		expect(tokens).toEqual(['STATUS_OFFLINE']);
	});
});
