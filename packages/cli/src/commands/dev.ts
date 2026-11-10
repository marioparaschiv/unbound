import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { createReloadTransport } from '~/lib/reload-transport';
import { bridgePortField } from '~/lib/context';
import { DevServer } from '~/lib/dev-server';
import { loadConfig } from '~/lib/config';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	report: defaulted(
		Type.Boolean({
			description:
				'After each rebuild, print its bundle size and the issues its build report counts. Slows each rebuild a little.',
		}),
		false,
	),
	port: bridgePortField,
});

const devCommand: CommandDefinition<typeof schema> = {
	name: 'dev',
	description:
		'Watch every addon in the workspace and rebuild only the addon whose files change, reloading ' +
		'it in the running client after each successful build. Runs until interrupted.',
	summary: 'Watch addons and rebuild on change.',
	surfaces: { cli: 'root', mcp: false },
	schema,
	async handler({ report }, context) {
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
	},
};

export default devCommand;
