(beforeRunApplication) => {
	if (globalThis.__unboundRunGateInstalled) {
		return true;
	}

	function gate(registry) {
		if (!registry || typeof registry !== 'object' || registry.__unboundGated) {
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
			Object.defineProperty(registry, '__unboundGated', { value: true });
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

	globalThis.__unboundRunGateInstalled = true;

	return true;
};
