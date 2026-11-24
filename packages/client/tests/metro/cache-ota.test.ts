import { expect, mock, test } from 'bun:test';

import { installSettingsBridge } from '../helpers/settings-bridge';

const BUILD = '123054';
const ids = [1, 2, 3];

Object.assign(globalThis, {
	window: globalThis,
	modules: new Map(ids.map((id) => [id, {}])),
});

// Discord 354.0 after its over-the-air update: same native build and module count, renumbered modules.
mock.module('~/native/native', () => ({
	BundleInfo: { Build: BUILD, OTABuild: '124441' },
	NativePlatform: undefined,
}));

// Saved under the app's own bundle, before the update applied.
installSettingsBridge({
	'unbound::cache': {
		info: { cacheVersion: 3, buildNumber: BUILD, moduleCount: ids.length },
		modules: { 'byProps::BackgroundBlurFill': [2] },
	},
});

const { CACHE_VERSION, getModuleCacheForKey, state } = await import('~/metro/cache');

test('drops a cache saved before an over-the-air update to the same build', () => {
	expect(CACHE_VERSION).toBe(3);
	expect(getModuleCacheForKey('byProps::BackgroundBlurFill')).toBeUndefined();
	expect(state.info.otaBuild).toBe('124441');
});
