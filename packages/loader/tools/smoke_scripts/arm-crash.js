(async function () {
	__FAULT_HELPERS__;
	var manager = unbound.plugins;
	var id = 'smoke.fault.crashes';
	var capabilities = ['native.ffi.call', 'native.ffi.symbols'];
	var fixture = smokeFixture(
		id,
		'Smoke fault: crashes',
		"({ start(context) { var ffi = context.native.ffi; ffi.call(ffi.symbol('abort'), { returnType: 'void', args: [] }); }, stop() {} })",
		capabilities,
	);
	var states = pluginSettings().get('states', {});
	states[id] = false;
	pluginSettings().set('states', states);
	await manager.reload(id, fixture.bundle, fixture.manifest);
	var consents = pluginSettings().get('consents', {});
	consents[id] = capabilities.slice().sort().join(',');
	pluginSettings().set('consents', consents);
	states = pluginSettings().get('states', {});
	states[id] = true;
	pluginSettings().set('states', states);
	await unbound.storage.persist();
	setTimeout(function () {
		manager.start(id);
	}, 200);
	return 'armed';
})();
