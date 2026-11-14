import { describe, expect, test } from 'bun:test';

import { formatLog } from '~/lib/format';

describe('formatLog', () => {
	test('tags a line from a loader that sends no source with its level', () => {
		expect(formatLog({ type: 'log', level: 2, message: 'Slow render' })).toBe(
			'[warn] Slow render',
		);
	});

	test('puts the source and scope between the level and the message', () => {
		expect(
			formatLog({
				type: 'log',
				level: 3,
				message: 'Failed to load theme t:',
				source: 'unbound',
				scope: ['Themes', 'Manager'],
				at: 1,
			}),
		).toBe('[error] unbound [Themes → Manager] Failed to load theme t:');
	});

	test('skips an empty scope', () => {
		expect(formatLog({ type: 'log', level: 1, message: 'hi', source: 'js', scope: [] })).toBe(
			'[log] js hi',
		);
	});
});
