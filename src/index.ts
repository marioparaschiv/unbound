async function init() {
	const Core = await import('@core');
	await Core.initialize();
}

const mdls = Object.values(modules);
const find = (prop: string) => mdls.find(m => m?.publicModule.exports?.[prop])?.publicModule?.exports;

window.ReactNative = find('AppState');
window.React = find('createElement');

init();