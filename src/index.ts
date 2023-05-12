try {
	const mdls = Object.values(modules);
	const find = (prop: string) => mdls.find(m => m?.publicModule.exports?.[prop])?.publicModule?.exports;

	window.ReactNative = find('AppState');
	window.React = find('createElement');

	try {
		const Core = import('@core');
		Core.then(c => c.initialize());
	} catch (e) {
		alert('Enmity failed to initialize: ' + e.message);
	}
} catch (e) {
	alert('Enmity failed to pre-initialize: ' + e.message);
}