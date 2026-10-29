export type SelfTestResult = {
	ok: boolean;
	detail: string;
};

const state = {
	applied: 0,
	failure: undefined as string | undefined,
	skips: new Set<string>(),
};

/**
 * @description Records that a plugin applied features, or removed them when `count` is negative.
 * @param count How many features were applied.
 */
export function recordApplied(count: number): void {
	state.applied = Math.max(0, state.applied + count);

	if (count > 0) {
		state.failure = undefined;
	}
}

/**
 * @description Records that a plugin failed to start and reverted what it had applied.
 * @param reason Why it failed.
 */
export function recordFailure(reason: string): void {
	state.failure = reason;
}

/**
 * @description Records that a plugin or one of its features skipped starting, such as when a module was not found.
 * @param reason Why it skipped.
 */
export function recordSkip(reason: string): void {
	state.skips.add(reason);
}

/**
 * @description Clears what this plugin recorded, for tests.
 */
export function resetHealth(): void {
	state.applied = 0;
	state.failure = undefined;
	state.skips.clear();
}

/**
 * @description Reports whether the plugin's features are applied, for the device matrix: a plugin that skipped or reverted its start passes `start` without doing anything.
 * @returns `ok` when at least one feature is applied and nothing failed or skipped, with a detail naming what was found.
 */
export function featureSelfTest(): SelfTestResult {
	if (state.failure) {
		return { ok: false, detail: `start failed and was reverted: ${state.failure}` };
	}

	if (state.skips.size) {
		return { ok: false, detail: `skipped: ${[...state.skips].join('; ')}` };
	}

	if (!state.applied) {
		return { ok: false, detail: 'no features are applied' };
	}

	return {
		ok: true,
		detail: `${state.applied} feature${state.applied === 1 ? '' : 's'} applied`,
	};
}

/**
 * @description Reports whether the plugin's features are applied and drew something, for the device matrix, which opens fixture messages first.
 * @param drawn How many things the plugin has drawn on screen, or `undefined` when it never started drawing.
 * @param noun What it draws, plural, such as `embeds`.
 * @returns `ok` when the features are applied and at least one thing is drawn.
 */
export function drawnSelfTest(drawn: (() => number) | undefined, noun: string): SelfTestResult {
	const features = featureSelfTest();

	if (!features.ok) {
		return features;
	}

	const count = drawn?.() ?? 0;

	return count > 0
		? { ok: true, detail: `${count} ${noun} drawn on screen` }
		: { ok: false, detail: `no ${noun} are drawn on screen` };
}

export default {
	drawnSelfTest,
	featureSelfTest,
	recordApplied,
	recordFailure,
	recordSkip,
	resetHealth,
};
