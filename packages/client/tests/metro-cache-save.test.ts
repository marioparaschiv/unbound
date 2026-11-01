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

// No `unbound::cache` Bucket: a fresh install, or a cache cleared by hand.
const { data, traffic } = installSettingsBridge();

jest.useFakeTimers();

const Cache = (await import('~/metro/cache')).default;
const { CACHE_VERSION } = await import('~/core/constants');

test('stages each changed cache field once per burst, with the info a later launch validates it by', () => {
	for (let id = 0; id < 2900; id++) {
		Cache.addAssetToCache(`Icon${id}.png`, id);
	}

	Cache.addCachedIDForKey('byProps::b', 3);
	Cache.markAssetsComplete();

	expect(traffic.staged).toEqual([]);

	jest.advanceTimersByTime(1000);

	expect(traffic.staged.map((change) => 'key' in change && change.key)).toEqual([
		'info',
		'assets',
		'modules',
		'paths',
		'assetsComplete',
	]);

	const saved = data['unbound::cache'];

	expect(saved.info).toEqual({
		cacheVersion: CACHE_VERSION,
		buildNumber: BUILD,
		moduleCount: ids.length,
	});
	expect(Object.keys(saved.assets as object)).toHaveLength(2900);
	expect(saved.modules).toEqual({ 'byProps::b': [3] });
	expect(saved.assetsComplete).toBe(true);
});
