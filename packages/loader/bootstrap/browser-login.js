(token) => {
	const apply = () => {
		const metro = globalThis.unbound?.metro;

		if (!metro || typeof metro.findByProps !== 'function') {
			throw new Error('Metro API unavailable');
		}

		const auth = metro.findByProps('getAnalyticsToken', 'setToken') ?? metro.findByProps('getToken', 'setToken');

		if (!auth || typeof auth.setToken !== 'function') {
			throw new Error('Discord authentication store unavailable');
		}

		auth.setToken(token);

		const reload = globalThis.unbound?.native?.reload;

		if (typeof reload !== 'function') {
			throw new Error('Reload API unavailable');
		}

		Promise.resolve(reload()).catch(() => {});
	};

	const ready = globalThis.__runtimeReady;

	if (ready?.ready) {
		apply();
	} else if (Array.isArray(ready?.callbacks)) {
		ready.callbacks.push(apply);
	} else {
		apply();
	}
};
