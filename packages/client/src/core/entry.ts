import { setRejectionTracker } from '~/diagnostics/promise-rejections';
import deferUntilReady from '~/core/loader';

// First, so rejections are logged from the start; the diagnostics built-in takes the tracker back
// after Discord's startup replaces it.
setRejectionTracker();

deferUntilReady(() => {
	require('./preinitialize');
	require('.');
});
