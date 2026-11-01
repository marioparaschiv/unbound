function smokeFixture(id, name, bundle, capabilities) {
	var manifest = {
		id: id,
		name: name,
		description: 'A smoke test fault fixture.',
		version: '1.0.0',
		main: 'index.js',
		authors: [{ name: 'Unbound smoke', id: '0' }],
	};
	if (capabilities) manifest.capabilities = capabilities;
	return { manifest: manifest, bundle: bundle };
}
function startedOthers(manager, id) {
	return manager.getAll().filter(function (entity) {
		return entity.id !== id && entity.started;
	}).length;
}
function settle(ms) {
	return new Promise(function (resolve) {
		setTimeout(resolve, ms);
	});
}
function pluginSettings() {
	return unbound.storage.getBucket('plugins');
}
