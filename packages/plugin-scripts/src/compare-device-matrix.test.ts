import { expect, test } from 'bun:test';

import { compareRuns, renderChanges, type MeasuredCheck } from './compare-device-matrix';
import { mergeChecks } from './collect-device-matrix';

function check(id: string, overrides: Partial<MeasuredCheck> = {}): MeasuredCheck {
	return {
		id,
		behavior: 'pass',
		lifecycle: 'pass',
		evidence: ['cycle'],
		metrics: { stopMs: 100, startMs: 300, leakedHooks: 0 },
		...overrides,
	};
}

test('reports nothing when a run matches the previous one', () => {
	expect(compareRuns([check('a')], [check('a')])).toEqual([]);
	expect(renderChanges([])).toContain('Nothing changed.');
});

test('reports plugins that newly fail or pass again', () => {
	const changes = compareRuns(
		[check('a'), check('b', { behavior: 'fail', note: 'broken' })],
		[check('a', { lifecycle: 'fail', note: 'restarting leaked 2 native hooks' }), check('b')],
	);

	expect(changes).toEqual(['a now fails: restarting leaked 2 native hooks', 'b passes again']);
});

test('reports stop and start times that more than doubled, and more leaked hooks', () => {
	const changes = compareRuns(
		[check('a')],
		[check('a', { metrics: { stopMs: 900, startMs: 450, leakedHooks: 1 } })],
	);

	expect(changes).toEqual([
		'a stops slower: 100 ms → 900 ms',
		'a leaves more native hooks behind: 0 → 1',
	]);
});

test('reports plugins added to or missing from a run', () => {
	expect(compareRuns([check('a')], [check('b')])).toEqual([
		'b is new and passes',
		'a was not checked this run',
	]);
});

test('merges a partial run into the previous results', () => {
	const merged = mergeChecks(
		[check('a'), check('b')],
		[check('b', { behavior: 'fail', note: 'x' }), check('c')],
	);

	expect(merged.map((item) => `${item.id}:${item.behavior}`)).toEqual([
		'a:pass',
		'b:fail',
		'c:pass',
	]);
});

test('reports off-main view calls a plugin did not make before', () => {
	const check = {
		id: 'unbound.alpha',
		behavior: 'pass',
		lifecycle: 'pass',
		evidence: [],
	} as const;

	expect(
		compareRuns(
			[{ ...check, evidence: [], offMainCalls: ['-[UIView layer]'] }],
			[{ ...check, evidence: [], offMainCalls: ['-[UIView bounds]', '-[UIView layer]'] }],
		),
	).toEqual(['unbound.alpha makes new off-main view calls: -[UIView bounds]']);
});
