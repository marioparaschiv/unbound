import { trackPromiseRejections } from '~/diagnostics/promise-rejections';
import deferUntilReady from '~/core/loader';

// First, so a rejection from here until Sentry takes the tracker over is logged too.
trackPromiseRejections();

deferUntilReady(() => {
	require('./preinitialize');
	require('.');
});
