/**
 * @description Creates a lazy object that will run its initializer once any property is accessed for the first time.
 * @template T The object type returned by the initializer.
 * @param initializer A function that returns the object you would like to make lazy.
 * @returns An object that appears empty but has the same properties as the object returned from the initializer.
 */
function lazy<T extends object>(initializer: () => T): T {
	let isInitialized = false;
	let lazyObject: T;

	// Resolve on first trap of any kind. Bundler ESM/CommonJS interop helpers (e.g. `_interopRequireWildcard`)
	// enumerate own keys to copy named exports, so `ownKeys`/`getOwnPropertyDescriptor`/`has` must forward to
	// the real object (not just `get`), otherwise every named export is silently dropped.
	function resolve(): T {
		if (!isInitialized) {
			lazyObject = initializer();
			isInitialized = true;
		}

		return lazyObject;
	}

	const proxy = new Proxy({} as T, {
		get: (_, prop) => resolve()[prop as keyof T],
		has: (_, prop) => prop in (resolve() as object),
		set: (_, prop, value) => ((resolve()[prop as keyof T] = value), true),
		deleteProperty: (_, prop) => delete resolve()[prop as keyof T],
		ownKeys: () => Reflect.ownKeys(resolve() as object),
		getPrototypeOf: () => Reflect.getPrototypeOf(resolve() as object),
		getOwnPropertyDescriptor: (_, prop) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(resolve() as object, prop);
			// Proxy invariant: a non-configurable target prop can't be reported for a configurable one, so
			// force `configurable` since the target is an empty, fully-configurable object.
			if (descriptor) descriptor.configurable = true;
			return descriptor;
		},
	});

	return proxy;
}

export default lazy;
