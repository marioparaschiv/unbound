import { setRejectionTracker } from '~/diagnostics/promise-rejections';
import deferUntilReady from '~/core/loader';

// First, so rejections are logged from the start; the diagnostics built-in takes the tracker back
// after Discord's startup replaces it.
setRejectionTracker();

deferUntilReady(() => {
	if (import.meta.env.BENCH) {
		globalThis.__ubdBench?.mark('ready:start');
	}

	require('./preinitialize');

	if (import.meta.env.BENCH) {
		globalThis.__ubdBench?.mark('preinitialize:end');
	}

	require('.');

	if (import.meta.env.BENCH) {
		globalThis.__ubdBench?.mark('core:end');
	}
});
