import { describe, expect, jest, test } from 'bun:test';

import { createRewriteRetry } from './rewrite-retry';

describe('rewrite retry', () => {
	test('retries a declined rewrite at most five times', () => {
		jest.useFakeTimers();

		try {
			const retry = createRewriteRetry();
			let runs = 0;

			for (let attempt = 0; attempt < 8; attempt++) {
				retry.retry('view', () => runs++);
				jest.advanceTimersByTime(60);
			}

			expect(runs).toBe(5);
		} finally {
			jest.useRealTimers();
		}
	});

	test('starts over once a rewrite succeeds, and clear cancels pending retries', () => {
		jest.useFakeTimers();

		try {
			const retry = createRewriteRetry();
			let runs = 0;

			for (let attempt = 0; attempt < 5; attempt++) retry.retry('view', () => runs++);

			retry.succeeded('view');
			retry.retry('view', () => runs++);
			retry.clear();
			jest.advanceTimersByTime(60);

			expect(runs).toBe(0);
		} finally {
			jest.useRealTimers();
		}
	});
});
