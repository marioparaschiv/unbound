async function init() {
	// import('@api/assets');

	const Core = await import('@core');
	await Core.initialize();
}

init();