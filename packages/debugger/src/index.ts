#!/usr/bin/env bun
import { isListening } from '@unbound-app/debugger-protocol/is-listening';

import { attachToBridge } from './lib/attach';
import { loadHistory } from './lib/history';
import { setupWebSocket } from './lib/ws';
import argv from './lib/cli';

await loadHistory();
await start();

/** Hosts the bridge, or attaches the terminal REPL to the one already on the port and takes over when it goes. */
async function start() {
	const { port } = argv.flags;

	if (!(await isListening(port)) && setupWebSocket()) return;

	// A bridge spawned in the background has no REPL to attach, so it leaves the port to the other one.
	if (!process.stdin.isTTY) {
		console.error(`A bridge already listens on port ${port}, exiting.`);
		process.exit(1);
	}

	attachToBridge(port, () => void start());
}
