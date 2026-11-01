import toError from '@unbound-app/utils/to-error';
import noop from '@unbound-app/utils/noop';

type Remove = () => void;

export type Subscriptions = {
	add: (remove: Remove) => Remove;
	dispose: () => void;
};

/**
 * @description Runs each disposer, last first, and keeps going past one that throws.
 * @param disposers The disposers, in the order their parts were created.
 * @throws The first error a disposer threw, once all of them ran.
 */
export function disposeInReverse(disposers: Remove[]): void {
	let failure: Error | undefined;

	for (const dispose of [...disposers].reverse()) {
		try {
			dispose();
		} catch (error) {
			failure ??= toError(error);
		}
	}

	if (failure) {
		throw failure;
	}
}

/**
 * @description Creates the tracker for one addon's listeners. A subscription added after dispose is removed at once.
 * @returns The tracker.
 */
export function createSubscriptions(): Subscriptions {
	const live = new Set<Remove>();
	let disposed = false;

	return {
		add(remove) {
			if (disposed) {
				remove();

				return noop;
			}

			function release() {
				if (!live.delete(release)) return;

				remove();
			}

			live.add(release);

			return release;
		},
		dispose() {
			disposed = true;
			disposeInReverse([...live]);
		},
	};
}

export default { createSubscriptions, disposeInReverse };
