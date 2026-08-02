import type { DiscordAsset, UnboundAsset } from '@unbound-app/types/assets';
import { mock } from 'bun:test';

// Discord test substrate. Unlike every other fixture in this suite, this one does NOT carry a
// contract the runtime enforces: `Constants.Fonts`, the `Assets` module and `ReactNative.Image` are
// Discord's own shapes, and nothing here verifies them against the real bundle. These tests assert
// our logic against a shape we invented. If Discord's real shape diverges - a renamed `Fonts` key
// format, an `Image` that no longer renders through `prototype.render`, a `getAssetByID` that
// throws rather than returning `null` past the end of the range - these tests stay green while the
// client breaks. That risk is accepted here and nowhere else in the suite; every other fixture
// models a contract we own.
//
// `~/api/metro/common` is module-mocked rather than driven through the metro fixture because it
// eagerly reads `window.ReactNative`/`window.React` at import, and its remaining members are lazy
// proxies that walk the entire module registry on the first property access of any kind.

/** The `Constants.Fonts` map: Discord's semantic font keys to their underlying family names. */
export type FontsMap = Record<string, unknown>;

/** The registered assets an `Assets.getAssetByID` lookup resolves against, keyed by id. */
export type AssetMap = Record<number, UnboundAsset>;

/** The `Image` component the icon-pack patch installs its `render` hook onto. */
export interface FakeImage {
	prototype: FakeImagePrototype;
}

/** `Image.prototype`, carrying the `render` the patcher wraps and the `props` the hook reads. */
export interface FakeImagePrototype {
	props?: ImageProps;
	render(): void;
}

/** The props an `Image` instance renders with; `source` is a numeric asset id until rewritten. */
export interface ImageProps {
	source: number | ImageSource;
}

/** The resolved source an applied icon pack rewrites a numeric `source` into. */
export interface ImageSource {
	uri: string;
	width: number;
	height: number;
	scale: number;
}

/** The synthetic `~/api/metro/common` surface the managers import. */
export interface CommonMock {
	Constants: CommonConstants;
	Assets: CommonAssets;
	ReactNative: CommonReactNative;
}

/** The `Constants` namespace, carrying only the `Fonts` map the Fonts manager derives targets from. */
export interface CommonConstants {
	Fonts: FontsMap;
}

/** The `Assets` namespace, carrying only the id lookup the icon-pack walk and patch consume. */
export interface CommonAssets {
	getAssetByID(id: number): UnboundAsset | null;
	/** Every id `getAssetByID` was called with, in call order, for asserting the walk's extent. */
	lookups: number[];
}

/** The `ReactNative` namespace, carrying only the `Image` whose `render` the pack patches. */
export interface CommonReactNative {
	Image: FakeImage;
}

/**
 * A `Constants.Fonts` map exercising the awkward shapes `getTargets` has to survive: a key with no
 * `_` separator, a value padded with whitespace, one family reachable from two different groups, a
 * family repeated within a single group, and a non-string value.
 */
export const SYNTHETIC_FONTS: FontsMap = {
	PRIMARY_NORMAL: 'gg sans',
	PRIMARY_SEMIBOLD: '  gg sans Semibold  ',
	PRIMARY_BOLD: 'gg sans, gg sans Semibold',
	DISPLAY_NORMAL: 'ABC Ginto Normal',
	DISPLAY_BOLD: 'gg sans',
	CODE_NORMAL: 'Source Code Pro',
	MONOSPACE: 'Menlo',
	PRIMARY_WEIGHT: 500,
};

function makeAsset(id: number, name: string, scales: number[], type: string): UnboundAsset {
	return {
		__packager_asset: true,
		name,
		httpServerLocation: `/assets/images/${name}`,
		width: 24 * id,
		height: 24 * id,
		scales,
		hash: `hash-${id}`,
		type,
	};
}

/** A small contiguous asset range: enough scales and types to drive the stamping paths. */
export const SYNTHETIC_ASSETS: AssetMap = {
	1: makeAsset(1, 'chat', [1, 2, 3], 'png'),
	2: makeAsset(2, 'friends', [1, 2], 'png'),
	3: makeAsset(3, 'settings', [1], 'svg'),
};

/**
 * @description Builds an `Assets` namespace over a fixed id range. `getAssetByID` returns `null`
 * for any id outside the map - including ids past the end - which is the termination contract the
 * icon-pack walk relies on to stop counting upwards.
 * @param assets The registered assets, keyed by id.
 * @returns The `Assets` namespace, with a lookup log.
 */
export function makeAssets(assets: AssetMap): CommonAssets {
	const lookups: number[] = [];

	return {
		lookups,
		getAssetByID: (id: number) => {
			lookups.push(id);
			return assets[id] ?? null;
		},
	};
}

/**
 * @description Builds an `Image` whose `render` records each invocation, so a test can prove the
 * icon-pack patch ran before the original and left the original reachable.
 * @returns The `Image` stand-in and the log of `props` seen by the unpatched `render`.
 */
export function makeImage(): FakeImage {
	return {
		prototype: {
			render() {},
		},
	};
}

/**
 * @description Replaces `~/api/metro/common` with the synthetic Discord surface. Must run before
 * the dynamic `import()` of either manager: both construct a module-level singleton at import, and
 * the real module's lazy proxies would walk a registry that does not exist under `bun test`.
 * @param fonts The `Constants.Fonts` map to expose.
 * @param assets The assets `Assets.getAssetByID` resolves against.
 * @returns The installed namespaces, for assertions and mid-test mutation.
 */
export function installCommonMock(
	fonts: FontsMap = SYNTHETIC_FONTS,
	assets: AssetMap = SYNTHETIC_ASSETS,
): CommonMock {
	const common: CommonMock = {
		Constants: { Fonts: fonts },
		Assets: makeAssets(assets),
		ReactNative: { Image: makeImage() },
	};

	mock.module('~/api/metro/common', () => common);

	return common;
}

/** One captured `fs.write` call, in invocation order. */
export interface FsWrite {
	path: string;
	payload: string;
	encoding: string | undefined;
}

/** The `~/api/fs` stand-in: a controllable `exists` set plus write and rm logs. */
export interface FsMock {
	Documents: string;
	/** Paths `exists` should resolve `true` for; every other path resolves `false`. */
	present: Set<string>;
	/** When set, `exists` rejects with it, standing in for an unreadable filesystem. */
	existsThrows?: Error;
	writes: FsWrite[];
	removals: string[];
	reset(): void;
}

/**
 * @description Replaces `~/api/fs` with an in-memory stand-in whose `exists` answers from a
 * mutable set, so a test can decide exactly which pack files are on disk.
 * @returns The stand-in, for seeding `present` and reading back writes and removals.
 */
export function installFsMock(): FsMock {
	const fsMock: FsMock = {
		Documents: '/docs',
		present: new Set<string>(),
		writes: [],
		removals: [],
		reset: () => {
			fsMock.present.clear();
			fsMock.existsThrows = undefined;
			fsMock.writes.length = 0;
			fsMock.removals.length = 0;
		},
	};

	mock.module('~/api/fs', () => ({
		default: {
			Documents: fsMock.Documents,
			write: async (path: string, payload: string, encoding?: string) => {
				fsMock.writes.push({ path, payload, encoding });
			},
			read: async () => '',
			rm: async (path: string) => {
				fsMock.removals.push(path);
				return true;
			},
			exists: async (path: string) => {
				if (fsMock.existsThrows) throw fsMock.existsThrows;
				return fsMock.present.has(path);
			},
		},
	}));

	return fsMock;
}

/** A binary route's response: its status and the bytes `arrayBuffer()` resolves to. */
export interface BinaryRoute {
	ok?: boolean;
	status?: number;
	bytes?: string;
}

/** The handle returned by `installBinaryFetchMock`: the requested urls and a restore. */
export interface BinaryFetchMock {
	urls: string[];
	restore(): void;
}

/**
 * @description Replaces the global `fetch` with a route table serving `arrayBuffer()` bodies, the
 * reader the font download path consumes. The shared `fetch-fixture` models only the `text()`/
 * `json()` readers, so binary downloads need this stand-in instead. An unrouted url rejects.
 * @param routes The url-to-response map to serve.
 * @returns A handle exposing the requested urls and a restore of the original `fetch`.
 */
export function installBinaryFetchMock(routes: Record<string, BinaryRoute>): BinaryFetchMock {
	const urls: string[] = [];
	const original = globalThis.fetch;

	const stub: typeof fetch = Object.assign(
		async (input: RequestInfo | URL): Promise<Response> => {
			const url = String(input);
			urls.push(url);

			const route = routes[url];
			if (!route) throw new Error(`No route registered for ${url}`);

			const ok = route.ok ?? true;
			const response = {
				ok,
				status: route.status ?? (ok ? 200 : 404),
				arrayBuffer: async () => new TextEncoder().encode(route.bytes ?? '').buffer,
			};

			return response as Response;
		},
		{ preconnect: original.preconnect },
	);

	globalThis.fetch = stub;

	return {
		urls,
		restore: () => void (globalThis.fetch = original),
	};
}

/**
 * @description Builds a registered asset, so a test can drive the stamping paths over scale and
 * type variants without restating the whole packager shape.
 * @param overrides The asset fields to vary; the rest carry inert defaults.
 * @returns A registered asset.
 */
export function makeRegisteredAsset(overrides: Partial<DiscordAsset> = {}): UnboundAsset {
	return {
		__packager_asset: true,
		name: 'icon',
		httpServerLocation: '/assets/images',
		width: 24,
		height: 24,
		scales: [1],
		hash: 'hash',
		type: 'png',
		...overrides,
	};
}

export default {
	installBinaryFetchMock,
	installCommonMock,
	installFsMock,
	makeAssets,
	makeImage,
	makeRegisteredAsset,
	SYNTHETIC_ASSETS,
	SYNTHETIC_FONTS,
};
