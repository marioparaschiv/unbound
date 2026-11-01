(async function () {
	__FAULT_HELPERS__;
	var manager = unbound.plugins;
	var id = 'smoke.fault.throws';
	var fixture = smokeFixture(
		id,
		'Smoke fault: throws',
		"({ start() { throw new Error('smoke fault: thrown on start'); }, stop() {} })",
	);
	var before = startedOthers(manager, id);
	await manager.reload(id, fixture.bundle, fixture.manifest);
	await manager.enable(id);
	await settle(300);
	var entity = manager.get(id);
	var error = manager.errors.get(id);
	var problem = '';
	if (!entity || !entity.failed) problem = 'a plugin that throws on start was not marked failed';
	else if (!error || String(error.message || error).indexOf('smoke fault: thrown on start') < 0)
		problem = 'the start error was not recorded: ' + String((error && error.message) || error);
	else if (startedOthers(manager, id) !== before)
		problem = 'other plugins stopped when one threw on start';
	await manager.uninstall(id);
	return JSON.stringify({
		name: 'throw on start',
		problem: problem,
		observed: entity
			? 'failed with ' + String((error && error.message) || error)
			: 'not loaded',
	});
})();
