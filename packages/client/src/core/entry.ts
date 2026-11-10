import { setRejectionTracker } from '~/diagnostics/promise-rejections';
import { benchMark } from '~/core/bench-span';
import deferUntilReady from '~/core/loader';

// First, so rejections are logged from the start; the diagnostics built-in takes the tracker back
// after Discord's startup replaces it.
setRejectionTracker();

deferUntilReady(() => {
	benchMark('ready:start');

	require('./preinitialize');

	benchMark('preinitialize:end');

	require('.');

	benchMark('core:end');
});
