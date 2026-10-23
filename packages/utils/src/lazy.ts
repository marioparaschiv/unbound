/**
 * @description Creates a lazy object that will run its initializer once any property is accessed for the first time.
 * @template T The object type returned by the initializer.
 * @param initializer A function that returns the object you would like to make lazy.
 * @returns An object that appears empty but has the same properties as the object returned from the initializer.
 */
function lazy<T extends object>(initializer: () => T): T {
	let isInitialized = false;
	let lazyObject: T;

	// Interop helpers like `_interopRequireWildcard` enumerate own keys to copy named exports, so
	// every trap must forward to the real object, not just `get`.
	function resolve(): T {
		if (!isInitialized) {
			lazyObject = initializer();
			isInitialized = true;
		}

		return lazyObject;
	}

	const target: T = Object.create(Object.prototype);

	const proxy = new Proxy(target, {
		get: (_, prop) => resolve()[prop as keyof T],
		has: (_, prop) => prop in (resolve() as object),
		set: (_, prop, value) => ((resolve()[prop as keyof T] = value), true),
		deleteProperty: (_, prop) => delete resolve()[prop as keyof T],
		ownKeys: () => Reflect.ownKeys(resolve()),
		getPrototypeOf: () => Reflect.getPrototypeOf(resolve()),
		getOwnPropertyDescriptor: (_, prop) => {
			const descriptor = Reflect.getOwnPropertyDescriptor(resolve(), prop);

			// Proxy invariant: a non-configurable target prop can't be reported for a configurable one, so
			// force `configurable` since the target is an empty, fully-configurable object.
			if (descriptor) {
				descriptor.configurable = true;
			}

			return descriptor;
		},
	});

	return proxy;
}

export default lazy;
