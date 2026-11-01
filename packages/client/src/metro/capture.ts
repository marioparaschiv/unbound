/** A Metro module factory, as Discord's bundle defines it. */
export type MetroFactory = (
	global: typeof globalThis,
	require: MetroRequire,
	importDefault: (id: number) => MetroExport,
	importAll: (id: number) => MetroExport,
	module: MetroPublicModule & { id: number },
	exports: MetroExport,
	dependencyMap: number[] | undefined,
) => void;

/** Runs a module's original factory the first time Metro requires the module. */
export type ModuleRunner = (
	factory: MetroFactory,
	id: number,
	args: Parameters<MetroFactory>,
) => void;

// Each module's original factory until it runs. Metro holds `sharedFactory` in its place.
const factories = new Map<number, MetroFactory>();
// Modules that ran before a runner was attached, in the order they ran.
const ranEarly: number[] = [];
let runner: ModuleRunner | undefined;

// One function stands in for every factory, so defining a module allocates nothing; Metro sets `module.id` before calling it.
function sharedFactory(...args: Parameters<MetroFactory>) {
	const id = args[4].id;
	const factory = factories.get(id);

	if (!factory) return;

	factories.delete(id);

	if (runner) {
		runner(factory, id, args);

		return;
	}

	ranEarly.push(id);
	factory.apply(globalThis, args);
}

function hookDefine(define: MetroDefine): MetroDefine {
	return function defineModule(factory: MetroFactory, id: number, dependencyMap?: number[]) {
		// Metro ignores a second definition of an id, so the first factory is the one that runs.
		if (!factories.has(id)) {
			factories.set(id, factory);
		}

		define(sharedFactory, id, dependencyMap);
	};
}

/**
 * @description Hooks Metro's `__d` before Discord's bundle assigns it, so every module is defined with one shared
 * factory and `globalThis.modules` holds the registry. Must run before Discord's bundle and import nothing.
 */
export function captureMetro(): void {
	let define: MetroDefine | undefined;

	Object.defineProperty(globalThis, '__d', {
		configurable: true,
		get() {
			if (typeof define !== 'function') {
				return define;
			}

			// The first read comes after Metro creates its empty registry and before it defines a module.
			// `__c()` returns that registry here; called any later, it would wipe every module.
			globalThis.modules = globalThis.__c!();

			const hooked = hookDefine(define);

			// A plain property from here on, so Discord's ~18,000 reads of `__d` skip this accessor.
			Object.defineProperty(globalThis, '__d', {
				value: hooked,
				writable: true,
				configurable: true,
			});

			return hooked;
		},
		set(value: MetroDefine) {
			define = value;
		},
	});
}

/**
 * @description Routes every module that has not run yet through `run` from now on.
 * @param run Runs a module's original factory.
 * @returns The ids of the modules that ran before `run` was attached, in the order they ran.
 */
export function attachRunner(run: ModuleRunner): number[] {
	runner = run;

	return ranEarly.splice(0);
}
