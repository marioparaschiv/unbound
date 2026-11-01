import { expect, test } from 'bun:test';

import { installSettingsBridge } from './helpers/settings-bridge';

const { data, traffic } = installSettingsBridge({
	astral: { 'developer-mode': true },
	'astral.text-replace': { stringRules: [{ find: 'a', replace: 'b' }] },
	'unbound.moyai': { enabled: true },
});

const { renameLegacyBuckets } = await import('~/storage/legacy-buckets');

test('copies the whole settings file once to find legacy Buckets, then never again', () => {
	renameLegacyBuckets();

	expect(data.unbound).toEqual({ 'developer-mode': true });
	expect(data['unbound.text-replace']).toEqual({ stringRules: [{ find: 'a', replace: 'b' }] });
	expect(data.astral).toBeUndefined();
	expect(data['astral.text-replace']).toBeUndefined();
	expect(traffic.fullReads).toBe(1);

	data['astral.translate'] = { target: 'fr' };
	renameLegacyBuckets();
	renameLegacyBuckets();

	expect(traffic.fullReads).toBe(1);
});
