(async function () {
	__FAULT_HELPERS__;
	var manager = unbound.plugins;
	var id = 'smoke.fault.freezes';
	var fixture = smokeFixture(
		id,
		'Smoke fault: freezes',
		'({ start() { var until = Date.now() + 8000; while (Date.now() < until) {} }, stop() {} })',
	);
	var before = startedOthers(manager, id);
	await manager.reload(id, fixture.bundle, fixture.manifest);
	await manager.enable(id);
	await settle(2500);
	await manager.stop(id);
	await manager.start(id);
	await settle(2500);
	var entity = manager.get(id);
	var enabled = pluginSettings().get('states', {})[id] === true;
	var freezes = manager.freezes ? manager.freezes.get(id) || 0 : undefined;
	var problem = '';
	if (freezes !== undefined && freezes < 2)
		problem =
			'the watchdog attributed ' + freezes + ' of 2 freezes to the plugin that froze Discord';
	else if (enabled || (entity && entity.started))
		problem = 'a plugin that froze Discord twice was not disabled';
	else if (startedOthers(manager, id) !== before)
		problem = 'other plugins stopped after one froze Discord';
	await manager.uninstall(id);
	return JSON.stringify({
		name: 'freeze on start',
		problem: problem,
		observed:
			(freezes === undefined ? 'freeze count not exposed' : freezes + ' freezes attributed') +
			', ' +
			(enabled ? 'still enabled' : 'disabled'),
	});
})();
