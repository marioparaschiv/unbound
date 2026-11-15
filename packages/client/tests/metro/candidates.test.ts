import { describe, expect, test } from 'bun:test';

const registry = { registerAsset: () => 1, getAssetByID: () => undefined };

type Registry = typeof registry;

function record(
	dependencyMap: number[] | undefined,
	exports: Registry | undefined,
	isInitialized: boolean,
) {
	return { dependencyMap, isInitialized, publicModule: { exports } };
}

const modules = new Map<number, ReturnType<typeof record>>([
	[84, record(undefined, registry, true)],
	[1134, record([84], undefined, false)],
	[1135, record([84], undefined, false)],
	[12528, record([1134], undefined, false)],
	[12529, record([1135, 84], undefined, false)],
	[12530, record([5], undefined, false)],
	[5, record([], undefined, false)],
	[12531, record([84], undefined, false)],
]);

Object.assign(globalThis, { window: globalThis, modules });

const { isAssetModule } = await import('~/metro/candidates');

describe('isAssetModule', () => {
	test('finds an image module whose registry is already loaded', () => {
		expect(isAssetModule(modules.get(12531) as never)).toBe(true);
	});

	test('finds an image module whose registry copy has not loaded yet', () => {
		expect(isAssetModule(modules.get(12528) as never)).toBe(true);
	});

	test('skips modules with other dependencies', () => {
		expect(isAssetModule(modules.get(12529) as never)).toBe(false);
		expect(isAssetModule(modules.get(12530) as never)).toBe(false);
	});
});
