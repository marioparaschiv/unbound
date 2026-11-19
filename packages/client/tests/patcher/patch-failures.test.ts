import { describe, expect, mock, test } from 'bun:test';

mock.module('~/toasts/api', () => ({ warning: () => undefined }));

const { FAILURE_LIMIT, isUpdateLoop, recordFailure } = await import('~/patcher/patch-failures');

function patch() {
	const unpatch = mock(() => undefined);

	return { failures: { name: 'MessageRow', count: 0, unstable: false, unpatch }, unpatch };
}

describe('patch failures', () => {
	test('recognises React update loops, in full and minified', () => {
		expect(
			isUpdateLoop(new Error('Maximum update depth exceeded. This can happen when…')),
		).toBe(true);
		expect(isUpdateLoop(new Error('Minified React error #185; visit https://react.dev'))).toBe(
			true,
		);
		expect(isUpdateLoop(new Error('Minified React error #1850'))).toBe(false);
		expect(isUpdateLoop('Maximum update depth exceeded')).toBe(false);
	});

	test('removes a patch that loops on its first failure', () => {
		const { failures, unpatch } = patch();

		recordFailure(failures, new Error('Maximum update depth exceeded'));

		expect(unpatch).toHaveBeenCalledTimes(1);
		expect(failures.count).toBe(FAILURE_LIMIT);

		recordFailure(failures, new Error('Maximum update depth exceeded'));

		expect(unpatch).toHaveBeenCalledTimes(1);
	});

	test('keeps other failures to three strikes', () => {
		const { failures, unpatch } = patch();

		recordFailure(failures, new Error('undefined is not a function'));
		recordFailure(failures, new Error('undefined is not a function'));

		expect(unpatch).not.toHaveBeenCalled();

		recordFailure(failures, new Error('undefined is not a function'));

		expect(unpatch).toHaveBeenCalledTimes(1);
	});
});
