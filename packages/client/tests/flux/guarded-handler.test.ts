import { describe, expect, test } from 'bun:test';

type Action = { type: string };

const { guardedHandler } = await import('~/flux/guarded-handler');

describe('guarded flux handlers', () => {
	test('swallow a throw and remove the handler on the third in a row', () => {
		let removed = 0;
		const handler = guardedHandler(
			(_action: Action) => {
				throw new Error('boom');
			},
			'Plugin',
			'MESSAGE_CREATE',
			() => removed++,
		);

		for (let index = 0; index < 5; index++) {
			expect(handler({ type: 'MESSAGE_CREATE' })).toBeUndefined();
		}

		expect(removed).toBe(1);
	});

	test('remove a handler that stays slow and keep a fast one', () => {
		let removed = 0;
		const slow = guardedHandler(
			(_action: Action) => {
				const until = performance.now() + 60;

				while (performance.now() < until) {
					continue;
				}

				return false;
			},
			'Plugin',
			'TYPING_START',
			() => removed++,
		);
		const fast = guardedHandler(
			(_action: Action) => true,
			'Plugin',
			'X',
			() => {
				removed += 100;
			},
		);

		for (let index = 0; index < 5; index++) {
			slow({ type: 'TYPING_START' });
			expect(fast({ type: 'X' })).toBe(true);
		}

		expect(removed).toBe(1);
	});
});
