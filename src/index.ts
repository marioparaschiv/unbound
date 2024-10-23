async function init() {
	const Core = await import('@core');
	await Core.initialize();
}

init();