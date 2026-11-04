import type { SessionStore } from '~/picture-in-picture/session/store';
import { windowAspect } from '~/picture-in-picture/aspect';
import { PLUGIN_NAME } from '~/constants';
import type { MediaSource, PipWindow } from '~/types';

export type Controller<Target> = {
	toggle(target: Target, source: MediaSource | undefined): void;
	isDisposed: () => boolean;
	subscribe: (listener: () => void) => () => void;
	dispose(): void;
};

export type ControllerOptions = {
	onFailed(): void;
	giveUpAfterMs: number;
};

function size(value: unknown): number | undefined {
	return typeof value === 'number' ? value : undefined;
}

/**
 * @description Starts and stops picture in picture when the media viewer's button is pressed, giving up on a window the system never shows.
 * @template Target The player a session belongs to.
 * @param sessions The session store.
 * @param window The platform's picture in picture window.
 * @param options What to do when the window does not start, and how long to wait for it.
 * @returns The controller.
 */
export function createController<Target>(
	sessions: SessionStore<Target>,
	window: PipWindow,
	options: ControllerOptions,
): Controller<Target> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	let disposed = false;
	const listeners = new Set<() => void>();

	function clearTimer() {
		if (timer !== undefined) clearTimeout(timer);

		timer = undefined;
	}

	function fail(target: Target) {
		sessions.end(target);

		if (!disposed) options.onFailed();
	}

	function giveUpLater(target: Target, phase: 'starting' | 'stopping') {
		clearTimer();
		timer = setTimeout(() => {
			timer = undefined;

			if (disposed || sessions.of(target)?.phase !== phase) return;

			if (phase === 'starting') fail(target);
			else sessions.end(target);
		}, options.giveUpAfterMs);
	}

	const stopTimer = sessions.subscribe((_, next) => {
		if (!next || next.phase === 'active') clearTimer();
	});

	async function start(target: Target, source: MediaSource | undefined) {
		giveUpLater(target, 'starting');

		const result = await window.enter(
			windowAspect(size(source?.width), size(source?.height)),
			source,
		);

		if (disposed || !sessions.of(target)) return;

		if (result === 'active') sessions.activate(target);

		if (result === 'failed') fail(target);
	}

	return {
		toggle(target, source) {
			if (disposed) return;

			const change = sessions.toggle(target);

			if (change === 'started') {
				start(target, source).catch((error: unknown) => {
					console.error(`[${PLUGIN_NAME}] Failed to start:`, error);
					fail(target);
				});
			}

			if (change === 'stopping') {
				if (window.exit() === 'ended') sessions.end(target);
				else giveUpLater(target, 'stopping');
			}
		},
		isDisposed: () => disposed,
		subscribe(listener) {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
		dispose() {
			if (disposed) return;

			disposed = true;
			clearTimer();
			stopTimer();
			window.dispose();

			for (const listener of [...listeners]) listener();

			listeners.clear();
		},
	};
}
