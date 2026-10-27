import deferUntilReady from '~/lib/loader';

deferUntilReady(() => {
	require('./preinitialize');
	require('.');
});
