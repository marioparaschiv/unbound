import type { Bucket, SettingsValues } from '@unbound-app/api/storage';
import { onChange } from '@unbound-app/api/storage';

type Store = Bucket;
type Cleanup = () => void;

function isBucket(source: Store | SettingsValues): source is Store {
	return (
		typeof source.get === 'function' &&
		typeof source.toggle === 'function' &&
		typeof source.remove === 'function'
	);
}

// Reads a dot-separated key through the sections of a settings object, falling back to `def` when it is not a boolean.
function readSetting(settings: SettingsValues, key: string, def: boolean): boolean {
	const value = key
		.split('.')
		.reduce<unknown>(
			(node, part) =>
				typeof node === 'object' && node !== null ? Reflect.get(node, part) : void 0,
			settings,
		);

	return typeof value === 'boolean' ? value : def;
}

/**
 * @description Runs `enable` while a boolean setting is on and its cleanup while it is off, so a feature's patches exist only when the user wants them.
 * @param store The plugin's settings Bucket from `storage.getBucket`, or its `settings` from `@unbound-app/settings`.
 * @param key The boolean setting that gates the feature, dot-separated inside a section.
 * @param def The setting's default value.
 * @param enable Applies the feature and returns the function that removes it.
 * @returns A function that removes the feature and stops listening; call it in `stop`.
 */
export function whileEnabled(
	store: Store | SettingsValues,
	key: string,
	def: boolean,
	enable: () => Cleanup,
): Cleanup {
	let disable: Cleanup | null = null;

	function sync() {
		const enabled = isBucket(store) ? store.get(key, def) : readSetting(store, key, def);

		if (enabled && !disable) {
			disable = enable();
		} else if (!enabled && disable) {
			disable();
			disable = null;
		}
	}

	// A change to the same key in another Bucket costs one extra read: `sync` is idempotent.
	const unsubscribe = onChange(
		(payload) =>
			payload.key === null || payload.key === key || key.startsWith(`${payload.key}.`),
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
