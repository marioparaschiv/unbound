import { describe, expect, mock, test } from 'bun:test';

import { followAsyncStart } from '~/addons/async-start';

function handlers() {
	const warnings: string[] = [];

	return {
		warnings,
		name: 'Slowpoke',
		logger: { warn: (message: string) => void warnings.push(message) },
		onSettled: mock(() => undefined),
		onFailed: mock((_failure: Error) => undefined),
	};
}

describe('followAsyncStart', () => {
	test('settles a start that resolves, without a slow warning', async () => {
		const options = handlers();

		followAsyncStart(Promise.resolve(), options);
		await Promise.resolve();

		expect(options.onSettled).toHaveBeenCalledTimes(1);
		expect(options.onFailed).not.toHaveBeenCalled();
		expect(options.warnings).toEqual([]);
	});

	test('settles and records a start that rejects', async () => {
		const options = handlers();

		followAsyncStart(Promise.reject(new Error('nope')), options);
		await new Promise((resolve) => setTimeout(resolve, 0));

		expect(options.onSettled).toHaveBeenCalledTimes(1);
		expect(options.onFailed.mock.calls[0]?.[0]?.message).toBe('nope');
	});
});
