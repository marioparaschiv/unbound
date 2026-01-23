async function initialize() {
	try {
		await import('./preinitialize');
		await import('.');
	} catch (error: any) {
		alert('Unbound failed to initialize: ' + ('stack' in error ? error.stack : String(error)));
	}
}

initialize();
