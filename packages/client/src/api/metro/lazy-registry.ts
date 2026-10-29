/** What a lazy module proxy stands for, so a patch on the proxy can wait for its module instead of loading it. */
export type LazyModule = {
	/** Calls `onLoad` with the proxy's module once it loads, without loading it; returns a function that stops waiting. */
	wait: (onLoad: (mdl: MetroExport) => void) => () => void;
	/** Makes `mdl` the proxy's module unless the proxy already resolved, and returns the proxy's module. */
	adopt: (mdl: MetroExport) => MetroExport;
};

const lazyModules = new WeakMap<WeakKey, LazyModule>();

/**
 * @description Records a lazy module proxy with how to wait for its module.
 * @param proxy The proxy handed to callers.
 * @param lazy How to wait for the proxy's module and adopt it.
 */
export function registerLazyModule(proxy: WeakKey, lazy: LazyModule): void {
	lazyModules.set(proxy, lazy);
}

/**
 * @description Reads how to wait for a lazy module proxy's module.
 * @param value A lazy module proxy or any other value.
 * @returns The proxy's entry, or `undefined` when `value` is not a lazy proxy.
 */
export function getLazyModule(value: MetroExport): LazyModule | undefined {
	if (typeof value !== 'object' || value === null) return;

	return lazyModules.get(value);
}

export default { registerLazyModule, getLazyModule };
