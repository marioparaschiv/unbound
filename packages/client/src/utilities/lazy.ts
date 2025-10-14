/**
 * @description Creates a lazy object that will run its initializer once any property is accessed for the first time.
 * @template T The object type returned by the initializer.
 * @param initializer A function that returns the object you would like to make lazy.
 * @returns An object that appears empty but has the same properties as the object returned from the initializer.
 */
function lazy<T extends object>(initializer: () => T): T {
	let isInitialized = false;
	let lazyObject: T;

	const proxy = new Proxy({}, {
		get(_, prop) {
			if (!isInitialized) {
				lazyObject = initializer();
				isInitialized = true;
			}

			return lazyObject[prop as keyof T];
		}
	});

	return proxy as T;
}

export default lazy;