import type { SessionStore } from '~/session/store';

export type HoldStore<Target> = {
	has(target: Target): boolean;
	hold(target: Target): void;
	releaseAll(): void;
	subscribe(listener: (target: Target) => void): () => void;
};

/**
 * @description Creates the store of players kept paused because their window was dismissed while Discord was in the background.
 * @template Target The player a hold belongs to.
 * @returns The store.
 */
export function createHoldStore<Target>(): HoldStore<Target> {
	const held = new Set<Target>();
	const listeners = new Set<(target: Target) => void>();

	function notify(target: Target) {
		for (const listener of listeners) listener(target);
	}

	return {
		has: (target) => held.has(target),
		hold(target) {
			if (held.has(target)) return;

			held.add(target);
			notify(target);
		},
		releaseAll() {
			const released = [...held];

			held.clear();

			for (const target of released) notify(target);
		},
		subscribe(listener) {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
	};
}

/**
 * @description Ends the session when the system's window closes, holding the player paused when Discord is still in the background.
 * @template Target The player a session belongs to.
 * @param sessions The session store.
 * @param holds The hold store.
 * @param inBackground Whether Discord was in the background when the window closed.
 */
export function endWindowSession<Target>(
	sessions: SessionStore<Target>,
	holds: HoldStore<Target>,
	inBackground: boolean,
): void {
	const target = sessions.current()?.target;

	if (inBackground && target !== undefined) holds.hold(target);

	sessions.end();
}
