import { createLogger } from '@unbound-app/logger';
import type { PatchParent } from 'possess';

/** More live patches than this from one caller on one method means the caller patches again on every call or render. */
export const REPEAT_LIMIT = 10;

const logger = createLogger('Patcher', 'Repeats');

/**
 * @description Counts each caller's live patches per patched object and method, and warns once when one passes {@link REPEAT_LIMIT}.
 * @param warn Receives the warning; logs it by default.
 * @returns `add`, which counts a new patch and returns the function that uncounts it.
 */
export function createRepeatTracker(
	warn: (message: string) => void = (message) => logger.warn(message),
) {
	const live = new WeakMap<PatchParent, Map<string, number>>();
	const warned = new Set<string>();

	return {
		add(parent: PatchParent, key: string): () => void {
			const counts = live.get(parent) ?? new Map<string, number>();
			const count = (counts.get(key) ?? 0) + 1;

			counts.set(key, count);
			live.set(parent, counts);

			if (count > REPEAT_LIMIT && !warned.has(key)) {
				warned.add(key);
				warn(
					`Patch ${key} is applied ${count} times at once; its plugin likely patches on every call or render instead of once when it starts.`,
				);
			}

			let released = false;

			return () => {
				if (released) return;

				released = true;
				counts.set(key, (counts.get(key) ?? 1) - 1);
			};
		},
	};
}

export default createRepeatTracker;
