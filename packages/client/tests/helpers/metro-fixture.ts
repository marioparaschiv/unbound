import { mock } from 'bun:test';

// Layer-A substrate for the metro suite. This file carries the RN/Hermes *container* contract only —
// the `window.modules` Map, the `__r` initialiser, `ErrorUtils`, the `__esModule`/`.default` interop
// helpers — all of which are stable across React Native versions. It deliberately encodes zero
// Discord bundle facts: no module ids, no store shapes, no proxy names. Tests supply their own
// modules per test; the engine's behaviour over those fixed inputs is what we assert.

/**
 * A module's resolved exports. Genuinely dynamic at this boundary — matching the codebase's own
 * `Map<number, any>` — so an export is either a keyed record or a callable (a component/factory
 * whose export *is* the function). `unknown` values keep call sites honest without an `any` cast.
 */
export type ModuleExports = Record<string, unknown> | ((...args: unknown[]) => unknown);

/** The mutable module object metro threads through a factory as it initialises (`args[4]`). */
export interface MetroModuleObject {
	exports: ModuleExports;
	id: number;
}

/**
 * A metro module factory: the closure `__r` invokes to initialise a module. Signature mirrors the
 * real one — `(global, require, importDefault, importAll, moduleObject, exports, dependencyMap)` —
 * so a hand-written factory reads exactly like a bundled one.
 */
export type ModuleFactory = (
	global: typeof globalThis,
	metroRequire: MetroRequire,
	metroImportDefault: MetroRequire,
	metroImportAll: MetroRequire,
	moduleObject: MetroModuleObject,
	exports: ModuleExports,
	dependencyMap: number[],
) => void;

/** RN's global uncaught-error handler registry, read by `initializeModule` around `__r`. */
export interface ErrorUtilsShape {
	getGlobalHandler(): (...args: unknown[]) => void;
	setGlobalHandler(handler: (...args: unknown[]) => void): void;
}

/**
 * @description Writes a host global the client's own typings don't declare (`ErrorUtils`, the
 * top-level `UNBOUND_SETTINGS`). Confines the single unavoidable cast — writing an untyped ambient
 * name onto `globalThis` — to one typed-in boundary so no test needs an `as any`.
 * @param name The global property name.
 * @param value The typed value to install.
 */
function defineGlobal<T>(name: string, value: T): void {
	(globalThis as Record<string, unknown>)[name] = value;
}

/** The raw record metro stores per id in `window.modules`, mirroring Hermes' container shape. */
export interface RawModuleRecord {
	factory?: ModuleFactory;
	publicModule: MetroModuleObject;
	isInitialized: boolean;
	hasError: boolean;
	__filePath?: string[];
}

/** Description of a single module to place in the registry. */
export interface ModuleSpec {
	exports?: ModuleExports;
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
	const exports: ModuleExports = spec.exports ?? {};

	if (spec.esModule && typeof exports === 'object' && !('__esModule' in exports)) {
		exports.__esModule = true;
	}

	// A plain-object export is copied onto the fresh module object; a function export (whose identity
	// `Object.assign` would silently drop) is assigned by reference, so `module.exports = fn` behaves
	// exactly as a real bundle's would.
	const isCallable = typeof exports === 'function';

	const factory: ModuleFactory =
		spec.factory ??
		((_g, _r, _d, _a, moduleObject) => {
			if (isCallable) {
				moduleObject.exports = exports;
			} else {
				Object.assign(moduleObject.exports, exports);
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
	defineGlobal('$$DEV$$', false);
}

/** The in-memory settings root `~/api/storage` reads at eval (`globalThis.UNBOUND_SETTINGS`). */
export type SettingsRoot = Record<string, Record<string, unknown>>;

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

	const metroRequire = ((id: number): ModuleExports | undefined => {
		const record = modules.get(id);
		if (!record) return undefined;

		if (!record.isInitialized) run(id);

		return record.publicModule.exports;
	}) as MetroRequire;
	metroRequire.importAll = metroRequire;

	const run: MetroRequire = ((id: number): ModuleExports | undefined => {
		const record = modules.get(id);
		if (!record) return undefined;

		record.factory?.(
			globalThis,
			metroRequire,
			metroRequire,
			metroRequire,
			record.publicModule,
			record.publicModule.exports,
			[],
		);

		record.isInitialized = true;

		return record.publicModule.exports;
	}) as MetroRequire;
	run.importAll = metroRequire;

	let globalHandler: (...args: unknown[]) => void = () => {};

	// Every host global goes through `defineGlobal`: bare assignment to an ambient `var` fails at
	// runtime under strict ESM (the name isn't a real binding), and `globalThis.<name>` won't
	// type-check for names the client doesn't declare on `typeof globalThis`. `window` carries only
	// the one field the engine reads.
	defineGlobal('window', { modules });
	defineGlobal('__r', run);

	const errorUtils: ErrorUtilsShape = {
		getGlobalHandler: () => globalHandler,
		setGlobalHandler: (handler) => void (globalHandler = handler),
	};
	defineGlobal('ErrorUtils', errorUtils);
	defineGlobal<SettingsRoot>('UNBOUND_SETTINGS', {});

	installSubstrateMocks(spec.build);

	return modules;
}

/**
 * @description Installs the bare globals `~/lib/cache` reads at eval, without the full metro walk:
 * a `window.modules` Map of the given size (cache only reads its key count) and an empty
 * `UNBOUND_SETTINGS` root. For tests that exercise the cache layer directly rather than search.
 * @param moduleCount The number of module ids the registry should report.
 * @returns The installed `UNBOUND_SETTINGS` root, so a test can seed persisted cache state on it.
 */
export function installCacheGlobals(moduleCount: number): SettingsRoot {
	installBuildTokens();

	const modules = new Map<number, RawModuleRecord>();
	for (let id = 1; id <= moduleCount; id++) {
		modules.set(id, makeModule({}, id));
	}

	defineGlobal('window', { modules });

	const settings: SettingsRoot = {};
	defineGlobal<SettingsRoot>('UNBOUND_SETTINGS', settings);

	return settings;
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

export default {
	installMetroGlobals,
	installCacheGlobals,
	installBuildTokens,
	installSubstrateMocks,
	makeModule,
};
