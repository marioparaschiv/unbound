import deferUntilReady from '~/core/loader';

deferUntilReady(() => {
	require('./preinitialize');
	require('.');
});
