import { init } from '.';

try {
	const mdls = Object.values(modules);
	const find = (prop: string) => mdls.find(m => m?.publicModule.exports?.[prop])?.publicModule?.exports;

	window.ReactNative = find('AppState');
	window.React = find('createElement');

	init();
} catch (e) {
	alert('Unbound failed to pre-initialize: ' + e.message);
}