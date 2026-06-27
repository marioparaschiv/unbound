import Logger from '@unbound-app/logger';

import { startServer } from './index';

const logger = Logger.create('Serve');

const server = startServer();

logger.log('Press Ctrl+C to stop');

process.on('SIGINT', () => {
	logger.newLine();
	logger.log('Shutting down server...');
	server.stop();
	logger.success('Server stopped');
	process.exit(0);
});
