/**
 * @description Creates a Proxy object with custom getter and fallback behavior.
 * @template T The object type that the proxy represents.
 * @param options Configuration object containing getter and fallback functions.
 * @param options.getter Function called when accessing a property, receives the property key.
 * @param options.fallback Function called when getter returns undefined, receives the property key.
 * @returns A Proxy object with the specified getter and fallback behavior.
 */
function createProxy<T extends object>(options: {
	getter: (prop: PropertyKey) => any;
	fallback: (prop: PropertyKey) => any;
}): T {
	const { getter, fallback } = options;

	const proxy = new Proxy({} as T, {
		get(_, prop) {
			const value = getter(prop);
			return value !== undefined ? value : fallback(prop);
		},
	});

	return proxy;
}

export default createProxy;
