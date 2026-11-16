import { afterEach, describe, expect, test } from 'bun:test';

import {
	clearPluginTemp,
	clearPluginTempOncePerLaunch,
	pluginTempPath,
} from '~/native/plugin-temp';

const original = globalThis.NativePlatform;

afterEach(() => {
	globalThis.NativePlatform = original;
});

function installPlatform(removed: string[], fail = false): void {
	Object.defineProperty(globalThis, 'NativePlatform', {
		configurable: true,
		writable: true,
		value: {
			files: {
				remove: (path: string) => {
					if (fail) {
						throw new Error('read-only');
					}

					removed.push(path);

					return true;
				},
			},
		},
	});
}

describe('pluginTempPath', () => {
	test('lies inside the Unbound folder', () => {
		expect(pluginTempPath('adrian.clips')).toBe('Unbound/Temp/adrian.clips');
	});
});

describe('clearPluginTemp', () => {
	test('removes the plugin folder relative to the Unbound folder', () => {
		const removed: string[] = [];

		installPlatform(removed);
		clearPluginTemp('adrian.clips');

		expect(removed).toEqual(['Temp/adrian.clips']);
	});

	test('survives a failing remove', () => {
		installPlatform([], true);

		expect(() => clearPluginTemp('adrian.clips')).not.toThrow();
	});
});

describe('clearPluginTempOncePerLaunch', () => {
	test('empties the folder on the first start only, so a restart keeps its files', () => {
		const removed: string[] = [];

		installPlatform(removed);
		clearPluginTempOncePerLaunch('adrian.launch');
		clearPluginTempOncePerLaunch('adrian.launch');
		clearPluginTempOncePerLaunch('adrian.other');

		expect(removed).toEqual(['Temp/adrian.launch', 'Temp/adrian.other']);
	});
});
