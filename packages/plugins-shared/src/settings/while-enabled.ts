import type { storage } from '@unbound-app/api';

type Store = ReturnType<typeof storage.getStore>;
type Cleanup = () => void;

/**
 * @description Runs `enable` while a boolean setting is on and its cleanup while it is off, so a feature's patches exist only when the user wants them.
 * @param store The plugin's settings store from `storage.getStore`.
 * @param key The boolean setting that gates the feature.
 * @param def The setting's default value.
 * @param enable Applies the feature and returns the function that removes it.
 * @returns A function that removes the feature and stops listening; call it in `stop`.
 */
export function whileEnabled(
	store: Store,
	key: string,
	def: boolean,
	enable: () => Cleanup,
): Cleanup {
	let disable: Cleanup | null = null;

	function sync() {
		const enabled = store.get(key, def);

		if (enabled && !disable) {
			disable = enable();
		} else if (!enabled && disable) {
			disable();
			disable = null;
		}
	}

	const unsubscribe = store.addListener(
		(payload) => payload.key === null || payload.key === key,
		sync,
	);

	sync();

	return () => {
		unsubscribe();
		disable?.();
		disable = null;
	};
}

export default whileEnabled;
