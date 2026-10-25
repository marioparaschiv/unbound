(() => {
	const map = globalThis.modules;

	if (!map || typeof map.values !== 'function') {
		return false;
	}

	let reactNative = false;
	let react = false;

	for (const module of map.values()) {
		const exports = module?.publicModule?.exports ?? module?.exports ?? module;

		for (const value of [exports, exports?.default, exports?.default?.default]) {
			if (!value) {
				continue;
			}

			if (!reactNative && value.AppState && value.NativeModules) {
				reactNative = true;
			}

			if (!react && typeof value.createElement === 'function') {
				react = true;
			}
		}
	}

	return reactNative && react;
})();
