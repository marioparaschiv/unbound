/** One hook call in a component's full signature, and how many hook objects it adds; `null` when unknown. */
export type HookCall = {
	key: string;
	cost: number | null;
};

/** How a changed hook list maps onto the mounted one: kept head, replaced middle, kept tail, in hook objects. */
export type HookPlan = {
	keep: number | null;
	remove: number | null;
	rest: number | null;
	insert: number;
};

/** The hook a full-signature line calls, and whether React Refresh's transform counts it as built in. */
export type HookName = {
	name: string;
	builtIn: boolean;
};

/** Where to cut and insert hook objects in one mounted fiber's list. */
export type HookSplice = {
	start: number;
	remove: number;
	insert: number;
};

/** How many hook objects each dispatcher method adds to a component's hook list, read from React 19's source. */
export const HOOK_COSTS: Record<string, number> = {
	useState: 1,
	useReducer: 1,
	useMemo: 1,
	useCallback: 1,
	useRef: 1,
	useEffect: 1,
	useLayoutEffect: 1,
	useInsertionEffect: 1,
	useImperativeHandle: 1,
	useId: 1,
	useDeferredValue: 1,
	useOptimistic: 1,
	useCacheRefresh: 1,
	useEffectEvent: 1,
	useTransition: 2,
	useSyncExternalStore: 2,
	useActionState: 3,
	useFormState: 3,
	readContext: 0,
	useContext: 0,
	use: 0,
	useDebugValue: 0,
	useMemoCache: 0,
	useHostTransitionStatus: 0,
};

// The hooks React Refresh's transform treats as built in: every other `use*` call is a custom hook it lists.
const BUILT_IN = new Set([
	'useState',
	'useReducer',
	'useEffect',
	'useLayoutEffect',
	'useMemo',
	'useCallback',
	'useRef',
	'useContext',
	'useImperativeHandle',
	'useDebugValue',
	'useId',
	'useDeferredValue',
	'useTransition',
	'useInsertionEffect',
	'useSyncExternalStore',
	'useFormStatus',
	'useFormState',
	'useActionState',
	'useOptimistic',
]);

/**
 * @description Reads the hook name a full-signature line starts with, e.g. `useState` from `React.useState{[a](0)}`.
 * @param line One line of a full signature.
 * @returns The hook's name, and whether the transform counts it as built in.
 */
export function hookName(line: string): HookName {
	const brace = line.indexOf('{');
	const callee = brace === -1 ? line : line.slice(0, brace);
	const name = callee.slice(callee.lastIndexOf('.') + 1);

	return { name, builtIn: BUILT_IN.has(name) };
}

/**
 * @description Sums the hook objects of a run of calls.
 * @param calls The calls.
 * @returns Their total, or `null` when one is unknown.
 */
function costOf(calls: HookCall[]): number | null {
	let total = 0;

	for (const call of calls) {
		if (call.cost === null) return null;

		total += call.cost;
	}

	return total;
}

/**
 * @description Diffs two hook-call lists into the head they share, the middle that changed and the tail they share.
 * @param previous The calls the mounted component made.
 * @param next The calls the new version makes.
 * @returns The plan in hook objects, or `null` when the inserted calls' cost is unknown.
 */
export function planHooks(previous: HookCall[], next: HookCall[]): HookPlan | null {
	const limit = Math.min(previous.length, next.length);

	let head = 0;

	while (head < limit && previous[head].key === next[head].key) head++;

	let tail = 0;

	while (
		tail < limit - head &&
		previous[previous.length - 1 - tail].key === next[next.length - 1 - tail].key
	) {
		tail++;
	}

	const insert = costOf(next.slice(head, next.length - tail));

	if (insert === null) return null;

	return {
		keep: costOf(previous.slice(0, head)),
		remove: costOf(previous.slice(head, previous.length - tail)),
		rest: costOf(previous.slice(previous.length - tail)),
		insert,
	};
}

/**
 * @description Fits a plan to a mounted fiber's hook list, filling at most one unknown count from its length.
 * @param plan The plan.
 * @param length How many hook objects the fiber holds.
 * @returns The splice, or `null` when the counts can't be known or don't add up to the list.
 */
export function fitPlan(plan: HookPlan, length: number): HookSplice | null {
	const counts = [plan.keep, plan.remove, plan.rest];
	const unknown = counts.filter((count) => count === null).length;

	if (unknown > 1) return null;

	const known = counts.reduce<number>((sum, count) => sum + (count ?? 0), 0);
	const [keep, remove, rest] = counts.map((count) => count ?? length - known);

	if (keep < 0 || remove < 0 || rest < 0 || keep + remove + rest !== length) return null;

	return { start: keep, remove, insert: plan.insert };
}
