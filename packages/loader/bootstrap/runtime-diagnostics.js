(() => {
	const map = globalThis.modules;
	const names = ['modules', '__c', '__d', '__r', 'React', 'NativeModules', '__fbBatchedBridge'];
	const globals = {};

	for (const name of names) {
		globals[name] = typeof globalThis[name];
	}

	return JSON.stringify({
		globals,
		moduleMap: !!map && typeof map.values === 'function',
		moduleCount: map?.size ?? null,
		defineName: globalThis.__d?.name ?? null,
		requireName: globalThis.__r?.name ?? null,
		registryKeys: map && typeof map.keys === 'function' ? [...map.keys()].slice(0, 10) : [],
	});
})();
