(() => {
	const namespaces = new Map();

	return {
		read(key) {
			return namespaces.get(key);
		},
		erase(key) {
			namespaces.delete(key);
		},
		create(key, source, active, limit) {
			const namespace = {};

			for (const name of Object.keys(source)) {
				const operation = source[name];

				namespace[name] =
					typeof operation === 'function'
						? function (...args) {
								if (!active()) {
									const error = new Error('The UI scope has been disposed');

									error.code = 'NATIVE_PLUGIN_SCOPE_DISPOSED';

									throw error;
								}

								return operation.apply(this, args);
							}
						: operation;
			}

			if (namespaces.size >= limit) {
				namespaces.delete(namespaces.keys().next().value);
			}

			namespaces.set(key, namespace);

			return namespace;
		},
	};
})();
