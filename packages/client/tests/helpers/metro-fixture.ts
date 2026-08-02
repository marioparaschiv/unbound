import { mock } from 'bun:test';

// Layer-A substrate for the metro suite. This file carries the RN/Hermes *container* contract only —
// the `window.modules` Map, the `__r` initialiser, `ErrorUtils`, the `__esModule`/`.default` interop
// helpers — all of which are stable across React Native versions. It deliberately encodes zero
// Discord bundle facts: no module ids, no store shapes, no proxy names. Tests supply their own
// modules per test; the engine's behaviour over those fixed inputs is what we assert.

/** A metro module factory: the wrapped closure `__r` invokes to initialise a module. */
export type ModuleFactory = (
	global: any,
	metroRequire: (id: number) => any,
	metroImportDefault: (id: number) => any,
	metroImportAll: (id: number) => any,
	moduleObject: { exports: any; id: number },
	exports: any,
	dependencyMap: number[],
) => void;

/** The raw record metro stores per id in `window.modules`, mirroring Hermes' container shape. */
export interface RawModuleRecord {
	factory?: ModuleFactory;
	publicModule: { exports: any; id: number };
	isInitialized: boolean;
	hasError: boolean;
	__filePath?: string;
}

/** Description of a single module to place in the registry. */
export interface ModuleSpec {
	exports?: any;
	esModule?: boolean;
	factory?: ModuleFactory;
	initialized?: boolean;
}

/** The full substrate spec: the modules to install, keyed by id, plus an optional build number. */
export interface MetroFixtureSpec {
	modules: Record<number, ModuleSpec>;
	build?: string;
}

/**
 * @description Builds a single raw module record. Every record is factory-backed and starts
 * uninitialised, mirroring the real Hermes container: a module metro has not yet run, whose exports
 * only exist once its factory executes. This matters because the engine's import-time walk hardens
 * modules through their (wrapped) factory — the no-factory path is never taken by a real bundle.
 *
 * A plain `exports` spec is lifted into a factory that seeds those exports onto the module object; an
 * explicit `factory` is used verbatim. When `esModule` is set the exports are stamped `__esModule:
 * true` so the interop unwrap paths engage. `initialized: true` opts a record into pre-initialised
 * state for the rare test that needs it.
 * @param spec The module description.
 * @param id The id the record is stored under.
 * @returns A raw metro module record.
 */
export function makeModule(spec: ModuleSpec, id: number): RawModuleRecord {
	const exports = spec.exports ?? {};

	if (spec.esModule && exports && typeof exports === 'object' && !('__esModule' in exports)) {
		exports.__esModule = true;
	}

	// A plain-object export is copied onto the fresh module object; a function or any other
	// non-plain-object export (which `Object.assign` would silently drop the identity of) is assigned
	// by reference, so `module.exports = fn` works exactly as a real bundle's would.
	const isPlainObject =
		exports !== null && typeof exports === 'object' && !Array.isArray(exports);

	const factory: ModuleFactory =
		spec.factory ??
		((_g, _r, _d, _a, moduleObject) => {
			if (isPlainObject) {
				Object.assign(moduleObject.exports, exports);
			} else {
				moduleObject.exports = exports;
			}
		});

	const initialized = spec.initialized ?? false;

	return {
		factory,
		publicModule: { exports: initialized ? exports : {}, id },
		isInitialized: initialized,
		hasError: false,
	};
}

/**
 * @description Defines the build-time replacement tokens (`$$DEV$$`, `$$I18N_BASE_URL$$`, …) as
 * globals so `~/lib/constants` — which the metro/cache layer pulls in transitively — evaluates under
 * `bun test`, where the build's `transform.define` that normally substitutes them never runs.
 */
export function installBuildTokens() {
	(globalThis as any).$$DEV$$ = false;
}

/**
 * @description Installs the metro globals and stubs the two RN-backed deps the metro/cache layer reads
 * at import time. Must run before the dynamic `import()` of any unit under test: a static import would
 * hoist above this and run the registry walk against an undefined `window.modules`.
 *
 * `__r(id)` runs the module's (possibly wrapped) factory with a metro-require closure that resolves
 * other modules' exports, then flips `isInitialized`, exactly as Hermes' real `__r` does.
 * @param spec The registry contents and optional build number.
 * @returns The installed `window.modules` Map, for assertions and mid-test mutation.
 */
export function installMetroGlobals(spec: MetroFixtureSpec): Map<number, RawModuleRecord> {
	installBuildTokens();

	const modules = new Map<number, RawModuleRecord>();

	for (const [id, moduleSpec] of Object.entries(spec.modules)) {
		modules.set(Number(id), makeModule(moduleSpec, Number(id)));
	}

	function metroRequire(id: number) {
		const record = modules.get(id);
		if (!record) return undefined;

		if (!record.isInitialized) __r(id);

		return record.publicModule.exports;
	}

	function __r(id: number) {
		const record = modules.get(id);
		if (!record) return undefined;

		if (record.factory) {
			record.factory(
				globalThis,
				metroRequire,
				metroRequire,
				metroRequire,
				record.publicModule,
				record.publicModule.exports,
				[],
			);
		}

		record.isInitialized = true;

		return record.publicModule.exports;
	}

	let globalHandler: (...args: any[]) => void = () => {};

	(globalThis as any).window = { modules };
	(globalThis as any).__r = __r;
	(globalThis as any).ErrorUtils = {
		getGlobalHandler: () => globalHandler,
		setGlobalHandler: (handler: (...args: any[]) => void) => void (globalHandler = handler),
	};
	(globalThis as any).UNBOUND_SETTINGS = {};

	installSubstrateMocks(spec.build);

	return modules;
}

/**
 * @description Stubs the two RN-backed modules the metro/cache layer imports at eval — `~/api/fs`
 * (whose real init reads native `DCDFileManager` paths) and `~/api/native` (whose `BundleInfo.Build`
 * feeds cache validity). Split out so tests that build their own globals (e.g. cache) can share it.
 * @param build The native build number `BundleInfo.Build` should report.
 */
export function installSubstrateMocks(build: string = '1') {
	mock.module('~/api/fs', () => ({
		default: {
			Documents: '/docs',
			write: async () => {},
			read: async () => '',
			rm: async () => true,
			exists: async () => false,
		},
	}));

	mock.module('~/api/native', () => ({
		BundleInfo: { Build: build },
		BundleManager: { reload: () => {} },
		DeviceInfo: {},
		getNativeModule: () => undefined,
	}));
}

export default { installMetroGlobals, installBuildTokens, installSubstrateMocks, makeModule };
