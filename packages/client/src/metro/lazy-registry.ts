type ModuleResolver = () => WeakKey | undefined;

const lazyModules = new WeakMap<WeakKey, ModuleResolver>();

/**
 * @description Records a lazy module proxy with the function that resolves it.
 * @param proxy The proxy handed to callers.
 * @param resolve Resolves the real module, or `undefined` while it is not loaded.
 */
export function registerLazyModule(proxy: WeakKey, resolve: ModuleResolver): void {
	lazyModules.set(proxy, resolve);
}

/**
 * @description Swaps a lazy module proxy for the module it stands for, so patches made through different proxies share one parent.
 * @template T The value's type.
 * @param value A lazy module proxy or any other value.
 * @returns The resolved module, or `value` when it is not a lazy proxy or its module is not loaded yet.
 */
export function resolveLazyModule<T>(value: T): T {
	if (typeof value !== 'object' || value === null) {
		return value;
	}

	const resolved = lazyModules.get(value)?.();

	return (resolved ?? value) as T;
}

export default { registerLazyModule, resolveLazyModule };
