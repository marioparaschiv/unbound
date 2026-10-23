import Logger from '@unbound-app/logger';

const logger = Logger.create('Dev');

// Set before importing the build module: it reads `UNBOUND_DEV` at module-eval time to bake the dev
// server URL into the bundle. Dynamic imports below keep this assignment ahead of that read.
process.env.UNBOUND_DEV = '1';

const { hotBuild } = await import('../build');
const { startServer } = await import('../serve');
const refresh = await import('../serve/refresh');

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
