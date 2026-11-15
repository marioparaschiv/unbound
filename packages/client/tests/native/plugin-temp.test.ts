import { afterEach, describe, expect, test } from 'bun:test';

import { clearPluginTemp, pluginTempPath } from '~/native/plugin-temp';

const original = globalThis.NativePlatform;

afterEach(() => {
	globalThis.NativePlatform = original;
});

function platformRecording(removed: string[], fail = false): typeof globalThis.NativePlatform {
	return {
		files: {
			remove: (path: string) => {
				if (fail) throw new Error('read-only');
				removed.push(path);
				return true;
			},
		},
	} as unknown as typeof globalThis.NativePlatform;
}

describe('pluginTempPath', () => {
	test('lies inside the Unbound folder', () => {
		expect(pluginTempPath('adrian.clips')).toBe('Unbound/Temp/adrian.clips');
	});
});

describe('clearPluginTemp', () => {
	test('removes the plugin folder relative to the Unbound folder', () => {
		const removed: string[] = [];

		globalThis.NativePlatform = platformRecording(removed);
		clearPluginTemp('adrian.clips');

		expect(removed).toEqual(['Temp/adrian.clips']);
	});

	test('survives a failing remove', () => {
		globalThis.NativePlatform = platformRecording([], true);

		expect(() => clearPluginTemp('adrian.clips')).not.toThrow();
	});
});
