import type {
	NativePlatformSettings,
	NativeSettingsChange,
	SettingsObject,
	SettingsValue,
} from '@unbound-app/types';

/** Traffic a fake settings bridge saw, as the loader's JSI calls would. */
export type SettingsTraffic = {
	fullReads: number;
	reads: string[];
	staged: NativeSettingsChange[];
	stagedBytes: number;
};

function isObject(value: SettingsValue | undefined): value is SettingsObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @description Builds a fake of the loader's lazy settings bridge, keyed by dot paths like `SettingsStore`.
 * Values cross it as copies, the way JSI converts them.
 * @param data The settings file the loader holds.
 * @returns The bridge and the traffic it saw.
 */
export function createSettingsBridge(data: Record<string, SettingsObject> = {}) {
	const traffic: SettingsTraffic = { fullReads: 0, reads: [], staged: [], stagedBytes: 0 };

	function apply(change: NativeSettingsChange) {
		if ('clear' in change) {
			delete data[change.store];

			return;
		}

		const parts = change.key.split('.');
		const last = parts.pop() ?? change.key;
		let current: SettingsObject = (data[change.store] ??= {});

		for (const part of parts) {
			const next = current[part];

			current = isObject(next) ? next : (current[part] = {});
		}

		if ('remove' in change) {
			delete current[last];
		} else {
			current[last] = structuredClone(change.value);
		}
	}

	const bridge: Required<NativePlatformSettings> = {
		apply: (changes) => bridge.stage(changes),
		stage(changes) {
			for (const change of changes) {
				traffic.staged.push(change);
				traffic.stagedBytes += JSON.stringify(change).length;
				apply(change);
			}

			return true;
		},
		flush: () => true,
		get(store, key = '') {
			if (store === undefined) {
				traffic.fullReads++;

				return structuredClone(data);
			}

			traffic.reads.push(`${store}:${key}`);

			let value: SettingsValue | undefined = data[store];

			for (const part of key ? key.split('.') : []) {
				value = isObject(value) ? value[part] : undefined;
			}

			return value === undefined ? undefined : structuredClone(value);
		},
	};

	return { bridge, data, traffic };
}

/**
 * @description Installs a fake lazy settings bridge as `NativePlatform.settings`. Call before importing `~/storage/api`.
 * @param data The settings file the loader holds.
 * @returns The bridge and the traffic it saw.
 */
export function installSettingsBridge(data: Record<string, SettingsObject> = {}) {
	const fake = createSettingsBridge(data);

	Object.defineProperty(globalThis, 'NativePlatform', {
		configurable: true,
		writable: true,
		value: { settings: fake.bridge },
	});

	return fake;
}
