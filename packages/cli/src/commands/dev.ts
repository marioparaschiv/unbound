import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { createReloadTransport } from '~/lib/reload-transport';
import { DevServer } from '~/lib/dev-server';
import { loadConfig } from '~/lib/config';

const schema = z.object({
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const devCommand: CommandDefinition<typeof schema> = {
	name: 'dev',
	description:
		'Watch every addon in the workspace and rebuild only the addon whose files change, reloading ' +
		'it in the running client after each successful build. Runs until interrupted.',
	surfaces: { cli: true, mcp: false },
	schema,
	async handler(_input, context) {
		const resolved = loadConfig();
		const server = new DevServer(resolved, createReloadTransport(context));

		process.on('SIGINT', () => {
			server.stop();
			process.exit(0);
		});

		await server.start();

		return new Promise<never>(() => {});
	},
};

export default devCommand;
