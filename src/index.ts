async function init() {
	try {
		const Core = await import('@core');
		Core.initialize();
	} catch (e) {
		alert('Unbound failed to initialize: ' + e.message);
	}
}

const mdls = Object.values(modules);
const find = (prop: string) => mdls.find(m => m?.publicModule.exports?.[prop])?.publicModule?.exports;

window.ReactNative = find('AppState');
window.React = find('createElement');

init();