import { describe, expect, test } from 'bun:test';

import { analyzeSamples, describeHookOwners } from '~/commands/debug/status-handler';

const sample = (handles: number, hooks = 12) => ({ handles, hooks, surfaces: 1, cachedReturns: 0 });

describe('analyzeSamples', () => {
	test('flags a resource that rises in most intervals and ends clearly higher', () => {
		const { growing, lines } = analyzeSamples([
			sample(40),
			sample(70),
			sample(95),
			sample(90),
			sample(130),
		]);

		expect(growing).toEqual(['handles']);
		expect(lines[0]).toBe('handles: 40 → 130, rose in 3 of 4 intervals — growing steadily');
	});

	test('leaves noise and a single jump alone', () => {
		expect(
			analyzeSamples([sample(40), sample(44), sample(41), sample(45), sample(42)]).growing,
		).toEqual([]);
		expect(
			analyzeSamples([sample(40), sample(40), sample(40), sample(200), sample(200)]).growing,
		).toEqual([]);
	});

	test('counts a hook that keeps being added', () => {
		expect(analyzeSamples([sample(40, 12), sample(40, 13), sample(40, 14)]).growing).toEqual([
			'hooks',
		]);
	});
});

describe('hook owners', () => {
	test('lists who holds hooks and what is left over', () => {
		expect(
			describeHookOwners(150, [
				{ owner: 'unbound.chat-bubbles', hooks: 60 },
				{ owner: 'unbound.message-latency', hooks: 3 },
			]),
		).toEqual([
			'Hooks by owner: unbound.chat-bubbles 60, unbound.message-latency 3; 87 in UI scopes, evals and the loader',
		]);
	});

	test('warns near the hook limit', () => {
		expect(describeHookOwners(230, [{ owner: 'a', hooks: 1 }])[1]).toStartWith(
			'Warning: 230 of 256 hooks are in use',
		);
	});

	test('says nothing without scoped hooks', () => {
		expect(describeHookOwners(150, [])).toEqual([]);
	});
});
