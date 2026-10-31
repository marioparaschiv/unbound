import { ADDON_KINDS } from '@unbound-app/types/addons';
import { expect, test } from 'bun:test';

import { openedBuckets } from './helpers/addons';

// The manager modules read Discord's modules off `window` while they load.
Reflect.set(globalThis, 'window', globalThis);

const { Manager } = await import('~/managers/base');

await import('~/managers/plugins');
await import('~/managers/themes');
await import('~/managers/icons');
await import('~/managers/fonts');

test('resolves the manager of every addon kind', () => {
	for (const kind of ADDON_KINDS) {
		expect(Manager.for(kind).kind).toBe(kind);
	}
});

test('keeps each manager on the bucket name it has always persisted to', () => {
	const buckets = Object.fromEntries(ADDON_KINDS.map((kind) => [kind, Manager.for(kind).bucket]));

	expect(buckets).toEqual({
		plugin: 'plugins',
		theme: 'themes',
		'icon-pack': 'icons',
		font: 'fonts',
	});
	expect(openedBuckets).toEqual(['plugins', 'themes', 'icons', 'fonts']);
});
