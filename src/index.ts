export async function init() {
	try {
		const Core = await import('@core');
		Core.initialize();
	} catch (e) {
		alert('Unbound failed to initialize: ' + e.message);
	}
}