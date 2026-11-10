import { settings, type BooleanSettingKey } from '@unbound-app/settings';
import { onChange } from '@unbound-app/api/storage';

type Cleanup = () => void;

// Reads a dot-separated key through the sections of the plugin's settings; the schema already applied the default.
function isOn(key: string): boolean {
	const value = key
		.split('.')
		.reduce<unknown>(
			(node, part) =>
				typeof node === 'object' && node !== null ? Reflect.get(node, part) : void 0,
			settings,
		);

	return value === true;
}

/**
 * @description Runs `enable` while a boolean setting of the plugin's settings.ts is on and its cleanup while it is off, so a feature's patches exist only when the user wants them.
 * @param key The boolean setting that gates the feature, dot-separated inside a section.
 * @param enable Applies the feature and returns the function that removes it.
 * @returns A function that removes the feature and stops listening; call it in `stop`.
 */
export function whileEnabled(key: BooleanSettingKey, enable: () => Cleanup): Cleanup {
	let disable: Cleanup | null = null;

	function sync() {
		const enabled = isOn(key);

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
