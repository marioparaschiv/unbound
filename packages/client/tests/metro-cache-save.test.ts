import { expect, jest, mock, test } from 'bun:test';

import { installSettingsBridge } from './helpers/settings-bridge';

const BUILD = '300000';
const ids = [1, 2, 3];

Object.assign(globalThis, {
	window: globalThis,
	modules: new Map(ids.map((id) => [id, {}])),
	$$DEV$$: false,
});

mock.module('~/native/native', () => ({ BundleInfo: { Build: BUILD } }));

const { traffic } = installSettingsBridge({
	'unbound::cache': {
		info: { cacheVersion: 1, buildNumber: BUILD, moduleCount: ids.length },
		modules: { 'byProps::a': [1] },
		moduleFlags: { 2: 1 },
		assets: [],
	},
});

jest.useFakeTimers();

const Cache = (await import('~/metro/cache')).default;

test('stages each changed cache field and the cache info once per burst, and leaves the rest alone', () => {
	for (let id = 0; id < 2900; id++) {
		Cache.addAssetToCache(id);
	}

	Cache.addCachedIDForKey('byProps::b', 3);
	jest.advanceTimersByTime(1000);

	expect(traffic.staged.map((change) => 'key' in change && change.key)).toEqual([
		'info',
		'assets',
		'modules',
	]);
	expect(Cache.state.assets).toHaveLength(2900);
});
