(async function () {
	__FAULT_HELPERS__;
	var manager = unbound.plugins;
	var id = 'smoke.fault.crashes';
	var entity = manager.get(id);
	var enabled = pluginSettings().get('states', {})[id] === true;
	var others = manager.getAll().filter(function (candidate) {
		return candidate.id !== id && candidate.started;
	}).length;
	var problem = '';
	if (!entity)
		problem = 'the plugin that crashed Discord was not loaded again after the relaunch';
	else if (enabled || entity.started)
		problem =
			'the plugin that crashed Discord while starting was not disabled after the relaunch';
	if (entity) await manager.uninstall(id);
	return JSON.stringify({
		name: 'native crash on start',
		problem: problem,
		observed:
			(entity ? (enabled ? 'still enabled' : 'disabled') : 'missing') +
			' after the relaunch, ' +
			others +
			' other plugins started',
	});
})();
