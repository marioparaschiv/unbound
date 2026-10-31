import noop from '@unbound-app/utils/noop';

type ModuleCallback = (mdl: MetroExport) => void;

type WaitForModule = (callback: ModuleCallback) => () => void;

const lazyModules = new WeakMap<WeakKey, WaitForModule>();

/**
 * @description Creates the proxy a lazy lookup returns, which runs the search on first access.
 * @param search Runs the search, loading modules as needed.
 * @param waitFor Calls back with the module once it has loaded, without loading it; omit it when the lookup stands for several modules.
 * @returns A proxy standing for the module.
 */
export function createLazyModule(search: () => MetroExport, waitFor?: WaitForModule): MetroExport {
	let cache: MetroExport;

	function resolve() {
		cache ??= search();

		return cache;
	}

	const proxy = new Proxy(
		{
			__METRO_LAZY__: true,
			get module() {
				return cache;
			},
		},
		{
			get(_, prop) {
				if (!prop || typeof prop !== 'string') return;

				resolve();

				if (prop === 'module') {
					return cache;
				}

				return cache?.[prop];
			},
			set(_, prop, value) {
				return Object.defineProperty(resolve() ?? {}, prop, {
					value,
					writable: true,
					configurable: true,
				});
			},
			// The patcher installs its wrapper with `Object.defineProperty`, which must reach the real module.
			defineProperty(_, prop, descriptor) {
				const module = resolve();

				return Boolean(module) && Reflect.defineProperty(module, prop, descriptor);
			},
		},
	);

	if (!waitFor) {
		return proxy;
	}

	lazyModules.set(proxy, (callback) => {
		if (cache) {
			callback(cache);

			return noop;
		}

		return waitFor((mdl) => {
			cache ??= mdl;
			callback(cache);
		});
	});

	return proxy;
}

/**
 * @description Calls back with the module a value stands for: at once for a loaded module or a plain value, else when a lazy proxy's module first loads.
 * @template T The value's type.
 * @param value A lazy module proxy or any other value.
 * @param callback Receives the module, or `value` itself when it is not a lazy proxy.
 * @returns A function that stops waiting.
 */
export function whenModuleLoads<T>(value: T, callback: (mdl: T) => void): () => void {
	const whenLoaded =
		typeof value === 'object' && value !== null ? lazyModules.get(value) : void 0;

	if (!whenLoaded) {
		callback(value);

		return noop;
	}

	return whenLoaded(callback);
}

export default { createLazyModule, whenModuleLoads };
