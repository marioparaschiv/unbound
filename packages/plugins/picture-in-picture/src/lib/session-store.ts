import type { Session } from '~/lib/types';

type Listener<Target> = (previous: Session<Target> | null, next: Session<Target> | null) => void;

export type SessionStore<Target> = {
	current(): Session<Target> | null;
	of(target: Target): Session<Target> | null;
	toggle(target: Target): 'started' | 'stopping' | 'unchanged';
	activate(target: Target): void;
	end(target?: Target): void;
	subscribe(listener: Listener<Target>): () => void;
};

/**
 * @description Creates the store of the one picture in picture session the system allows at a time.
 * @template Target The player a session belongs to.
 * @returns The store.
 */
export function createSessionStore<Target>(): SessionStore<Target> {
	let session: Session<Target> | null = null;
	const listeners = new Set<Listener<Target>>();

	function set(next: Session<Target> | null) {
		const previous = session;

		if (previous === next) return;

		session = next;

		for (const listener of listeners) listener(previous, next);
	}

	function of(target: Target): Session<Target> | null {
		return session?.target === target ? session : null;
	}

	function update(target: Target, change: Partial<Session<Target>>) {
		const current = of(target);

		if (current) set({ ...current, ...change });
	}

	return {
		current: () => session,
		of,
		toggle(target) {
			const current = of(target);

			if (current?.phase === 'stopping') return 'unchanged';

			if (current) {
				set({ ...current, phase: 'stopping' });

				return 'stopping';
			}

			if (session) set(null);

			set({ target, phase: 'starting' });

			return 'started';
		},
		activate(target) {
			if (of(target)?.phase === 'starting') update(target, { phase: 'active' });
		},
		end(target) {
			if (target === undefined || of(target)) set(null);
		},
		subscribe(listener) {
			listeners.add(listener);

			return () => listeners.delete(listener);
		},
	};
}
