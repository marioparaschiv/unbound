try {
	const mdls = Object.values(modules);
	const find = (prop: string) => mdls.find(m => m?.publicModule.exports?.[prop])?.publicModule?.exports;

	window.ReactNative = find('AppState');
	window.React = find('createElement');

	const mdl = mdls.find(m => m.factory);
	const orig = mdl.factory;

	mdl.factory = function (...args) {
		const res = orig.apply(this, args);

		if (res instanceof Promise) {
			res.then(init);
		} else {
			init();
		}

		mdl.factory = orig;

		return res;
	};
} catch (e) {
	alert('Unbound failed to pre-initialize: ' + e.message);
}

async function init() {
	try {
		const Core = await import('@core');
		Core.initialize();
	} catch (e) {
		alert('Unbound failed to initialize: ' + e.message);
	}
}