import { mock } from 'bun:test';

// Metro test substrate. Carries the RN/Hermes container contract only (the `window.modules` Map,
// `__r`, `ErrorUtils`, `__esModule`/`.default` interop) and zero Discord bundle facts.

/** A module's resolved exports: a keyed record, or a callable whose export *is* the function. */
export type ModuleExports = Record<string, unknown> | ((...args: unknown[]) => unknown);

/** The mutable module object metro threads through a factory (`args[4]`). */
export interface MetroModuleObject {
	exports: ModuleExports;
	id: number;
}

/** A metro module factory: the closure `__r` invokes to initialise a module. */
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
 * @description Writes a host global the client's own typings don't declare, keeping the untyped
 * `globalThis` write to one typed-in boundary.
 * @param name The global property name.
 * @param value The typed value to install.
 */
export function defineGlobal<T>(name: string, value: T): void {
	(globalThis as Record<string, unknown>)[name] = value;
}

/** The raw record metro stores per id in `window.modules`. */
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

/** The registry to install, keyed by id, plus an optional build number. */
export interface MetroFixtureSpec {
	modules: Record<number, ModuleSpec>;
	build?: string;
}

/** The in-memory settings root `~/api/storage` reads at eval (`globalThis.UNBOUND_SETTINGS`). */
export type SettingsRoot = Record<string, Record<string, unknown>>;

/**
 * @description Builds a raw module record. Records are factory-backed and start uninitialised,
 * mirroring the Hermes container the engine's import-time walk hardens through a wrapped factory.
 * @param spec The module description.
 * @param id The id the record is stored under.
 * @returns A raw metro module record.
 */
export function makeModule(spec: ModuleSpec, id: number): RawModuleRecord {
	const exports: ModuleExports = spec.exports ?? {};

	if (spec.esModule && typeof exports === 'object' && !('__esModule' in exports)) {
		exports.__esModule = true;
	}

	// A function export is assigned by reference; `Object.assign` would drop its identity.
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
 * @description Defines the build-time tokens so `~/lib/constants` evaluates under `bun test`, where
 * the build's `transform.define` never runs.
 */
export function installBuildTokens() {
	defineGlobal('$$DEV$$', false);
}

/**
 * @description Installs the metro globals and stubs the RN-backed deps the metro/cache layer reads at
 * import time. Must run before the dynamic `import()` of any unit under test.
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
 * @description Installs the bare globals `~/lib/cache` reads at eval - a `window.modules` Map of the
 * given size and an empty `UNBOUND_SETTINGS` root - without the full metro walk.
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
 * @description Stubs the RN-backed modules the metro/cache layer imports at eval (`~/api/fs`,
 * `~/api/native`).
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
	defineGlobal,
	makeModule,
};
