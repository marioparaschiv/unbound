import { createReloadTransport } from '~/lib/reload-transport';
import type { CommandHandler } from '~/lib/lazy-handler';
import { DevServer } from '~/lib/dev-server';
import { loadConfig } from '~/lib/config';

import type devCommand from './dev';

const handler: CommandHandler<typeof devCommand.schema> = async ({ report }, context) => {
	const resolved = loadConfig();

	if ('error' in resolved) {
		return { ok: false, text: resolved.error };
	}

	const server = new DevServer(resolved, createReloadTransport(context), report);

	process.on('SIGINT', () => {
		server.stop();
		process.exit(0);
	});

	await server.start();

	return new Promise<never>(() => {});
};

export default handler;
