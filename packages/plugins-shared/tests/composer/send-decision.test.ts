import { beforeEach, describe, expect, mock, test } from 'bun:test';

import type { SendArgs } from '../../src/composer/held-send';
import { decideSend } from '../../src/composer/send-decision';

const ARGS: SendArgs = ['709062739581992971', { content: 'hello' }];
const error = mock(() => {});

beforeEach(() => {
	error.mockClear();
	Object.assign(globalThis, { logger: { error } });
});

describe('decideSend', () => {
	test('sends when the guard allows it', async () => {
		expect(await decideSend('Test', () => true, ARGS)).toBe('send');
	});

	test('restores when the guard refuses it', async () => {
		expect(await decideSend('Test', async () => false, ARGS)).toBe('restore');
	});

	test('sends and logs when the guard throws', async () => {
		const decision = await decideSend(
			'Test',
			() => {
				throw new Error('moved');
			},
			ARGS,
		);

		expect(decision).toBe('send');
		expect(error).toHaveBeenCalledTimes(1);
	});

	test('sends and logs when the guard rejects', async () => {
		expect(await decideSend('Test', () => Promise.reject(new Error('moved')), ARGS)).toBe(
			'send',
		);
		expect(error).toHaveBeenCalledTimes(1);
	});
});
