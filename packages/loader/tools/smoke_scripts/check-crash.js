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
	var stack = '';
	var history = [];
	try {
		stack = (await unbound.fs.readFile('Unbound/native-crash.txt')) || '';
		history = JSON.parse((await unbound.fs.readFile('Unbound/crash-history.json')) || '[]');
	} catch (error) {
		problem = problem || 'the crash files could not be read: ' + String(error);
	}
	var newest = history.length ? history[history.length - 1] : null;
	if (!problem && !/^Signal 6\n[\s\S]*#0 0x/.test(stack))
		problem = 'native-crash.txt does not hold the SIGABRT stack after the relaunch';
	else if (!problem && !(newest && typeof newest.stack === 'string' && newest.stack === stack))
		problem = 'crash-history.json does not keep the crash stack';
	if (entity) await manager.uninstall(id);
	return JSON.stringify({
		name: 'native crash on start',
		problem: problem,
		observed:
			(entity ? (enabled ? 'still enabled' : 'disabled') : 'missing') +
			' after the relaunch, ' +
			others +
			' other plugins started, ' +
			(stack ? 'stack kept' : 'no stack'),
	});
})();
