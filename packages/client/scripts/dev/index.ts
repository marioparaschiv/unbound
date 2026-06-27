import Logger from '@unbound-app/logger';

const logger = Logger.create('Dev');

// Set before importing the build module: it reads `UNBOUND_DEV` at module-eval time to bake the dev
// server URL into the bundle. Dynamic imports below keep this assignment ahead of that read.
process.env.UNBOUND_DEV = '1';

const { watchBuild } = await import('../build');
const { startServer } = await import('../serve');

const watcher = watchBuild();
const server = startServer();

logger.log('Press Ctrl+C to stop');

process.on('SIGINT', async () => {
	logger.newLine();
	logger.log('Shutting down...');
	await watcher.close();
	server.stop();
	logger.success('Stopped');
	process.exit(0);
});
