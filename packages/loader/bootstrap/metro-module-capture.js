(() => {
	if (globalThis.__unboundModuleCaptureInstalled) {
		return true;
	}

	let define = globalThis.__d;

	Object.defineProperty(globalThis, '__d', {
		configurable: true,
		get() {
			if (!globalThis.modules && typeof globalThis.__c === 'function') {
				const modules = globalThis.__c();

				if (modules && typeof modules.values === 'function') {
					globalThis.modules = modules;
				}
			}

			return define;
		},
		set(value) {
			define = value;
		},
	});

	globalThis.__unboundModuleCaptureInstalled = true;

	return true;
})();
