import type { Activity } from '~/types';

export type Schedule = (callback: () => void, delay: number) => () => void;

export type PresenceSyncOptions = {
	query: () => Promise<Activity | null>;
	dispatch: (activity: Activity | null) => void;
	schedule: Schedule;
	refreshDelay: number;
};

/**
 * @description Creates the state machine that sends scrobbler results as an activity: it sends only changes, skips a poll while one
 * is running, reruns once a running poll finishes after a settings change, and clears the activity on stop if one was sent.
 * @param options The query to run, the dispatcher, a timer scheduler and the settings refresh delay.
 * @returns `poll`, `refresh` (a delayed poll after a settings change) and `stop`.
 */
export function createPresenceSync({
	query,
	dispatch,
	schedule,
	refreshDelay,
}: PresenceSyncOptions) {
	let lastSent = JSON.stringify(null);
	let running = false;
	let stale = false;
	let stopped = false;
	let cancelRefresh: (() => void) | undefined;

	function send(activity: Activity | null) {
		const serialized = JSON.stringify(activity);

		if (serialized === lastSent) return;

		lastSent = serialized;
		dispatch(activity);
	}

	async function run(): Promise<void> {
		running = true;
		stale = false;

		const activity = await query().catch(() => null);

		running = false;

		if (stopped) return;
		if (stale) return run();

		send(activity);
	}

	function poll(): Promise<void> {
		if (stopped || running) return Promise.resolve();

		return run();
	}

	function pollWithFreshSettings(): Promise<void> {
		if (stopped) return Promise.resolve();
		if (!running) return run();

		stale = true;
		return Promise.resolve();
	}

	function refresh() {
		cancelRefresh?.();
		cancelRefresh = schedule(() => {
			cancelRefresh = undefined;
			void pollWithFreshSettings();
		}, refreshDelay);
	}

	function stop() {
		stopped = true;
		cancelRefresh?.();
		cancelRefresh = undefined;

		if (lastSent !== JSON.stringify(null)) dispatch(null);
	}

	return { poll, refresh, stop };
}
