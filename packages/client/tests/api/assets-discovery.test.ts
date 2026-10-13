import type { DiscordAsset, UnboundAsset } from '@unbound-app/types/assets';
import { describe, expect, test, mock } from 'bun:test';

import { type ModuleFactory, installMetroGlobals } from '../helpers/metro-fixture';

// Asset ids are deliberately offset from their module ids so the registry key (the exported number)
// and the cache key (the module id) can never be confused for one another.
const ASSET_IDS = { chat: 101, chatSvg: 102, star: 103, orphan: 104 } as const;

// A resolvable non-number export: the asset module would happily hand back a record for it, so the
// cold walk's `typeof` guard is the only thing keeping it out of the registry.
const STRING_EXPORT = 'not-a-number';

const table = new Map<unknown, DiscordAsset>([
	[ASSET_IDS.chat, makeAsset('Chat', 'png')],
	[ASSET_IDS.chatSvg, makeAsset('Chat', 'svg')],
	[ASSET_IDS.star, makeAsset('Star', 'png')],
	[STRING_EXPORT, makeAsset('StringKeyed', 'png')],
]);

function makeAsset(name: string, type: string): DiscordAsset {
	return { name, type, width: 24, height: 24, scales: [1], hash: `${name}-${type}` };
}

/** Builds a factory whose module export *is* the given value, as an asset module's export is. */
function exporting(value: unknown): ModuleFactory {
	return (_g, _r, _d, _a, moduleObject) => {
		moduleObject.exports = value as never;
	};
}

installMetroGlobals({
	modules: {
		1: { factory: exporting(ASSET_IDS.chat) },
		2: { factory: exporting(ASSET_IDS.chatSvg) },
		3: { factory: exporting(ASSET_IDS.star) },
		4: { factory: exporting(STRING_EXPORT) },
		5: { factory: exporting(ASSET_IDS.orphan) },
		6: {
			factory: () => {
				throw new Error('module init blew up');
			},
		},
	},
});

mock.module('~/api/metro/common', () => ({
	Assets: {
		// RN's real implementation is an unguarded table lookup, so a non-number id is not rejected on
		// its way in - it simply reads whatever the key happens to hit.
		getAssetByID: (id: number): DiscordAsset | null => table.get(id) ?? null,
	},
}));

const Assets = await import('~/api/assets');
const Cache = (await import('~/lib/cache')).default;

// The real cache is left in play: `initializeModule` blacklists through it, so stubbing it would
// change the very failure path this file exercises.
const cachedIds = Cache.getCachedAssets();

describe('cold discovery walk', () => {
	test('an asset is registered under its exported id while the cache records its module id', () => {
		expect(Assets.assets.get(ASSET_IDS.chat)).toEqual(table.get(ASSET_IDS.chat)!);
		expect(Assets.assets.has(1)).toBe(false);

		expect(cachedIds).toContain(1);
		expect(cachedIds).not.toContain(ASSET_IDS.chat);
	});

	test('a non-number export is skipped even though the asset module would resolve it', () => {
		expect(table.get(STRING_EXPORT)).toBeDefined();

		expect(Assets.getByName('StringKeyed')).toBeUndefined();
		expect(cachedIds).not.toContain(4);
	});

	test('a number export the asset module does not know is skipped', () => {
		expect(Assets.assets.has(ASSET_IDS.orphan)).toBe(false);
		expect(cachedIds).not.toContain(5);
	});

	test('a module that throws on init is skipped rather than aborting the walk', () => {
		expect(cachedIds).not.toContain(6);
		// The walk still reached module ids beyond the thrower.
		expect(Assets.assets.size).toBe(3);
	});
});

describe('find', () => {
	test('returns the first asset matching the predicate', () => {
		expect(Assets.find((asset) => asset.name === 'Star')).toEqual(table.get(ASSET_IDS.star)!);
	});

	test('returns undefined when nothing matches', () => {
		expect(Assets.find((asset) => asset.height === 999)).toBeUndefined();
	});
});

describe('getByName', () => {
	test('defaults to png, and the svg twin is reachable by asking for it', () => {
		const png: UnboundAsset | undefined = Assets.getByName('Chat');
		expect(png?.type).toBe('png');
		expect(Assets.getByName('Chat', 'svg')?.type).toBe('svg');
	});

	test('a name that only exists as svg is not found under the png default', () => {
		Assets.assets.set(999, makeAsset('SvgOnly', 'svg'));

		expect(Assets.getByName('SvgOnly')).toBeUndefined();
		expect(Assets.getByName('SvgOnly', 'svg')?.name).toBe('SvgOnly');

		Assets.assets.delete(999);
	});
});

describe('getByID', () => {
	test('resolves a registered id and misses on an unregistered one', () => {
		expect(Assets.getByID(ASSET_IDS.star)?.name).toBe('Star');
		expect(Assets.getByID(ASSET_IDS.orphan)).toBeUndefined();
	});
});

describe('getIDByName', () => {
	test('returns the id for the matching type, defaulting to png', () => {
		expect(Assets.getIDByName('Chat')).toBe(ASSET_IDS.chat);
		expect(Assets.getIDByName('Chat', 'svg')).toBe(ASSET_IDS.chatSvg);
	});

	test('returns undefined for an unknown name', () => {
		expect(Assets.getIDByName('Missing')).toBeUndefined();
	});
});

describe('getAll', () => {
	test('returns every registered asset', () => {
		expect(Assets.getAll()).toHaveLength(3);
	});
});

describe('Icons proxy', () => {
	test('a property name resolves through getIDByName with the png default', () => {
		expect(Assets.Icons.Chat).toBe(ASSET_IDS.chat);
		expect(Assets.Icons.Star).toBe(ASSET_IDS.star);
	});

	test('an unknown property is undefined', () => {
		expect(Assets.Icons.Nonexistent).toBeUndefined();
	});
});
