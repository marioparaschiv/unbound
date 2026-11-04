import { describe, expect, test } from 'bun:test';

import { fitPlan, hookName, planHooks } from '~/hot-refresh/hook-diff';
import type { HookCall } from '~/hot-refresh/hook-diff';

function calls(...entries: [string, number | null][]): HookCall[] {
	return entries.map(([key, cost]) => ({ key, cost }));
}

describe('hook diff', () => {
	test('reads the hook name of a full-signature line', () => {
		expect(hookName('React.useState{[a, setA](0)}')).toEqual({
			name: 'useState',
			builtIn: true,
		});
		expect(hookName('Discord.useNavigation{navigation}')).toEqual({
			name: 'useNavigation',
			builtIn: false,
		});
	});

	test('inserts an added hook after the ones it kept', () => {
		const previous = calls(['useState{a}', 1], ['useEffect{}', 1]);
		const next = calls(['useState{a}', 1], ['useMemo{m}', 1], ['useEffect{}', 1]);

		expect(planHooks(previous, next)).toEqual({ keep: 1, remove: 0, rest: 1, insert: 1 });
	});

	test('removes a dropped hook and keeps the rest', () => {
		const previous = calls(['useState{a}', 1], ['useTransition{}', 2], ['useRef{r}', 1]);
		const next = calls(['useState{a}', 1], ['useRef{r}', 1]);

		expect(planHooks(previous, next)).toEqual({ keep: 1, remove: 2, rest: 1, insert: 0 });
	});

	test('replaces a hook whose call changed', () => {
		const previous = calls(['useState{a}(0)', 1]);
		const next = calls(['useState{a}(1)', 1]);

		expect(planHooks(previous, next)).toEqual({ keep: 0, remove: 1, rest: 0, insert: 1 });
	});

	test('gives up when an added hook adds an unknown number of hook objects', () => {
		expect(
			planHooks(calls(['useState{a}', 1]), calls(['useState{a}', 1], ['useX{}', null])),
		).toBeNull();
	});

	test('fills one unknown count from the mounted hook list', () => {
		const previous = calls(['useStyles{s}', null], ['useState{a}', 1]);
		const next = calls(['useStyles{s}', null], ['useState{a}', 1], ['useRef{r}', 1]);
		const plan = planHooks(previous, next);

		expect(plan && fitPlan(plan, 4)).toEqual({ start: 4, remove: 0, insert: 1 });
	});

	test('refuses a plan with two unknown counts or one that does not add up', () => {
		expect(fitPlan({ keep: null, remove: null, rest: 0, insert: 1 }, 3)).toBeNull();
		expect(fitPlan({ keep: 1, remove: 1, rest: 1, insert: 0 }, 5)).toBeNull();
	});
});
