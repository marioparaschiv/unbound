(beforeRunApplication) => {
	if (globalThis.__astralRunGateInstalled) {
		return true;
	}

	function gate(registry) {
		if (!registry || typeof registry !== 'object' || registry.__astralGated) {
			return registry;
		}

		const run = registry.runApplication;

		if (typeof run !== 'function') {
			return registry;
		}

		registry.runApplication = function (...args) {
			try {
				beforeRunApplication();
			} catch {}

			return run.apply(this, args);
		};

		try {
			Object.defineProperty(registry, '__astralGated', { value: true });
		} catch {}

		return registry;
	}

	let current = gate(globalThis.RN$AppRegistry);

	Object.defineProperty(globalThis, 'RN$AppRegistry', {
		configurable: true,
		enumerable: true,
		get() {
			return current;
		},
		set(value) {
			current = gate(value);
		},
	});

	globalThis.__astralRunGateInstalled = true;

	return true;
};
