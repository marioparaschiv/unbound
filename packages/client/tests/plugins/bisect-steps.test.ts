import { describe, expect, test } from 'bun:test';

import {
	answerBisect,
	beginBisect,
	isBisectResult,
	roundsLeft,
	testedPlugins,
	type BisectState,
} from '~/plugins/bisect-steps';

const PLUGINS = ['a', 'b', 'c', 'd', 'e'];

type Outcome = { culprit: string | null; rounds: number };

function run(culprit: string | null): Outcome {
	let state: BisectState = beginBisect(PLUGINS);

	for (let rounds = 1; rounds < 20; rounds++) {
		const on = testedPlugins(state);
		const next = answerBisect(state, culprit === null || on.includes(culprit));

		if (isBisectResult(next)) {
			return { culprit: next.culprit, rounds };
		}

		state = next;
	}

	throw new Error('The bisect never ended');
}

describe('plugin bisect', () => {
	test('first checks the problem with every plugin off', () => {
		expect(testedPlugins(beginBisect(PLUGINS))).toEqual([]);
	});

	test('reports no culprit when the problem happens with every plugin off', () => {
		expect(answerBisect(beginBisect(PLUGINS), true)).toEqual({ culprit: null });
	});

	test('finds each plugin as the culprit within the rounds it estimates', () => {
		const estimate = roundsLeft(beginBisect(PLUGINS));

		for (const culprit of PLUGINS) {
			const result = run(culprit);

			expect(result.culprit).toBe(culprit);
			expect(result.rounds).toBeLessThanOrEqual(estimate);
		}
	});

	test('tests half the suspects each round', () => {
		const halving = answerBisect(beginBisect(PLUGINS), false) as BisectState;

		expect(testedPlugins(halving)).toEqual(['a', 'b', 'c']);
		expect(answerBisect(halving, false)).toMatchObject({ suspects: ['d', 'e'], round: 2 });
	});

	test('names a lone plugin once the problem goes away without it', () => {
		expect(answerBisect(beginBisect(['only']), false)).toEqual({ culprit: 'only' });
	});
});
