import Logger from '@unbound-app/logger';

import { IS_DEV_BUILD } from '../build/constants';
import * as refresh from '../serve/refresh';
import { startServer } from '../serve';
import { hotBuild } from '../build';

const logger = Logger.create('Dev');

// The build bakes the dev server URL in only for a dev build, which `--dev` or `UNBOUND_DEV=1` selects.
if (!IS_DEV_BUILD) {
	logger.error('Run the dev server with `--dev` (as `bun run dev` does) or `UNBOUND_DEV=1`.');
	process.exit(1);
}

const engine = await hotBuild((update) => void refresh.deliver(update));

refresh.attach(engine);

const server = startServer(false);

logger.log('Press Ctrl+C to stop');

async function shutdown() {
	logger.newLine();
	logger.log('Shutting down...');
	await engine.close();
	server.stop();
	logger.success('Stopped');
	process.exit(0);
}

process.on('SIGINT', () => void shutdown());
