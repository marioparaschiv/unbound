async function init() {
	const Core = await import('~/lib/core');
	await Core.initialize();
}

init();