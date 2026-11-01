import { captureMetro } from '~/metro/capture';

/** A module factory as a test writes it; Metro passes every argument. */
export type FakeFactory = (
	global: typeof globalThis,
	require: (id: number) => MetroExport,
	importDefault: (id: number) => MetroExport,
	importAll: (id: number) => MetroExport,
	module: MetroPublicModule,
	exports: MetroExport,
	dependencyMap: number[],
) => void;

/** A Metro runtime started after Unbound's capture, the order the loader evaluates them in. */
export type FakeMetro = {
	/** Defines a module through the global `__d`, as Discord's bundle does. */
	define: (id: number, dependencyMap: number[], factory: FakeFactory) => void;
	/** Metro's `require`: runs a module once, recording a throw the way Metro does. */
	require: (id: number) => MetroExport;
};

/**
 * @description Captures Metro, then runs a prelude shaped like Discord's: it assigns `__r`, `__d` and `__c`
 * before it creates its registry, so `globalThis.modules` comes from the capture.
 * @returns The fake runtime's `define` and `require`.
 */
export function startFakeMetro(): FakeMetro {
	captureMetro();

	let registry = new Map<number, MetroModuleRecord>();

	function metroRequire(id: number): MetroExport {
		const record = registry.get(id);

		if (!record) {
			throw new Error(`No module ${id}`);
		}

		if (record.isInitialized || record.hasError) {
			return record.publicModule.exports;
		}

		record.isInitialized = true;
		record.publicModule.id = id;

		try {
			record.factory?.(
				globalThis,
				metroRequire,
				metroRequire,
				metroRequire,
				record.publicModule,
				record.publicModule.exports,
				record.dependencyMap ?? [],
			);
		} catch (error) {
			record.hasError = true;
			record.isInitialized = false;
			record.publicModule.exports = undefined;

			throw error;
		}

		record.factory = undefined;
		record.dependencyMap = undefined;

		return record.publicModule.exports;
	}

	Object.assign(globalThis, {
		__r: metroRequire,
		__d(factory: FakeFactory, id: number, dependencyMap: number[]) {
			if (registry.has(id)) return;

			registry.set(id, {
				factory,
				dependencyMap,
				isInitialized: false,
				hasError: false,
				publicModule: { exports: {} },
			});
		},
		__c: () => (registry = new Map()),
	});

	registry = new Map();

	return {
		define: (id, dependencyMap, factory) => globalThis.__d(factory, id, dependencyMap),
		require: metroRequire,
	};
}
