import {
	answerBisect as nextRound,
	beginBisect,
	isBisectResult,
	roundsLeft,
	testedPlugins,
	type BisectResult,
	type BisectState,
} from '~/plugins/bisect-steps';
import { getSetting, setSetting } from '~/settings/unbound';
import { isLibrary } from '~/addons/dependencies';
import { plugins } from '~/plugins/manager';
import { reload } from '~/native/native';
import { persist } from '~/storage/api';

const RELOAD_DELAY_MS = 500;

export type BisectStatus = {
	round: number;
	roundsLeft: number;
	tested: string[];
	suspects: string[];
};

function suspectIds(): string[] {
	const installed = plugins.getAddons();

	return installed
		.filter((addon) => plugins.isEnabled(addon.id) && !isLibrary(addon, installed))
		.map((addon) => addon.id);
}

function reloadSoon() {
	setTimeout(() => void persist().finally(() => void reload()), RELOAD_DELAY_MS);
}

function applyRound(state: BisectState) {
	const tested = new Set(testedPlugins(state));

	for (const id of state.original) plugins.storeEnabled(id, tested.has(id));

	reloadSoon();
}

function restore(original: string[], culprit: string | null) {
	for (const id of original) plugins.storeEnabled(id, id !== culprit);

	reloadSoon();
}

/**
 * @description Reads the bisect in progress.
 * @returns Its round, how many rounds are left and which plugins are on, or `undefined` when none runs.
 */
export function bisectStatus(): BisectStatus | undefined {
	const state = getSetting('plugins.bisect');

	if (!state) {
		return undefined;
	}

	return {
		round: state.round + 1,
		roundsLeft: roundsLeft(state),
		tested: testedPlugins(state),
		suspects: [...state.suspects],
	};
}

/**
 * @description Starts finding the plugin that causes a problem: turns Recovery Mode off and every plugin off for a first
 * check. Each round saves which plugins are on and reloads Discord, so no plugin starts or stops mid-session.
 * @returns The first round, or `undefined` when no plugin is on to test.
 */
export function startBisect(): BisectStatus | undefined {
	const suspects = suspectIds();

	if (!suspects.length) {
		return undefined;
	}

	const state = beginBisect(suspects);

	setSetting('recovery', false);
	setSetting('plugins.bisect', state);
	applyRound(state);

	return bisectStatus();
}

/**
 * @description Answers the current round and moves to the next, turning on the plugins it tests.
 * @param stillHappens Whether the problem still happens with this round's plugins on.
 * @returns The next round, or the result once found, when every plugin is back on except the culprit.
 */
export function answerBisect(stillHappens: boolean): BisectStatus | BisectResult | undefined {
	const state = getSetting('plugins.bisect');

	if (!state) {
		return undefined;
	}

	const next = nextRound(state, stillHappens);

	if (isBisectResult(next)) {
		setSetting('plugins.bisect', null);
		restore(state.original, next.culprit);

		return next;
	}

	setSetting('plugins.bisect', next);
	applyRound(next);

	return bisectStatus();
}

/**
 * @description Stops the bisect and turns back on every plugin that was on when it started.
 */
export function stopBisect(): void {
	const state = getSetting('plugins.bisect');

	if (!state) return;

	setSetting('plugins.bisect', null);
	restore(state.original, null);
}
