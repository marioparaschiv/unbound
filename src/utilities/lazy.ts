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