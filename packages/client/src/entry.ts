import deferUntilReady from '~/lib/loader';

deferUntilReady(async () => {
	await import('./preinitialize');
	await import('.');
});
