export type BisectState = {
	original: string[];
	suspects: string[];
	phase: 'baseline' | 'halving';
	round: number;
};

/** How a finished bisect ended. */
export type BisectResult = {
	/** The plugin that causes the problem, or `null` when the problem happens with every plugin off. */
	culprit: string | null;
};

/**
 * @description Starts a bisect over the enabled plugins, first checking the problem with every plugin off.
 * @param enabled The ids of the enabled plugins.
 * @returns The new bisect.
 */
export function beginBisect(enabled: string[]): BisectState {
	return { original: [...enabled], suspects: [...enabled], phase: 'baseline', round: 0 };
}

/**
 * @description Lists the plugins that are on for this round: none at the baseline, then the first half of the suspects.
 * @param state The bisect.
 * @returns The ids to enable; every other plugin from `original` is off.
 */
export function testedPlugins(state: BisectState): string[] {
	return state.phase === 'baseline'
		? []
		: state.suspects.slice(0, Math.ceil(state.suspects.length / 2));
}

/**
 * @description Narrows the suspects by whether the problem still happens with this round's plugins on.
 * @param state The bisect.
 * @param stillHappens Whether the user still sees the problem.
 * @returns The next round, or the result once one plugin is left or the baseline shows plugins are not the cause.
 */
export function answerBisect(
	state: BisectState,
	stillHappens: boolean,
): BisectState | BisectResult {
	if (state.phase === 'baseline') {
		if (stillHappens || !state.suspects.length) {
			return { culprit: null };
		}

		return state.suspects.length === 1
			? { culprit: state.suspects[0] }
			: { ...state, phase: 'halving', round: state.round + 1 };
	}

	const tested = testedPlugins(state);
	const suspects = stillHappens ? tested : state.suspects.filter((id) => !tested.includes(id));

	if (suspects.length <= 1) {
		return { culprit: suspects[0] ?? null };
	}

	return { ...state, suspects, round: state.round + 1 };
}

/**
 * @description Estimates how many more answers the bisect needs.
 * @param state The bisect.
 * @returns The rounds left, counting the current one.
 */
export function roundsLeft(state: BisectState): number {
	const halvings = Math.ceil(Math.log2(Math.max(1, state.suspects.length)));

	return (state.phase === 'baseline' ? 1 : 0) + halvings;
}

/**
 * @description Tells a finished bisect from one still running.
 * @param value What `answerBisect` returned.
 * @returns Whether the bisect has ended.
 */
export function isBisectResult(value: BisectState | BisectResult): value is BisectResult {
	return 'culprit' in value;
}
