(() => {
	const namespaces = new Map();

	const scoped = (operation, active) =>
		function (...args) {
			if (!active()) {
				const error = new Error('The UI scope has been disposed');

				error.code = 'NATIVE_PLUGIN_SCOPE_DISPOSED';

				throw error;
			}

			return operation.apply(this, args);
		};

	return {
		read(key) {
			return namespaces.get(key);
		},
		erase(key) {
			namespaces.delete(key);
		},
		create(key, source, active, limit) {
			const namespace = Object.fromEntries(
				Object.keys(source).map((name) => {
					const operation = source[name];

					return [
						name,
						typeof operation === 'function' ? scoped(operation, active) : operation,
					];
				}),
			);

			if (namespaces.size >= limit) {
				namespaces.delete(namespaces.keys().next().value);
			}

			namespaces.set(key, namespace);

			return namespace;
		},
	};
})();
