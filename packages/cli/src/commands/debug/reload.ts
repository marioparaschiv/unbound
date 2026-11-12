import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	timeout: defaulted(
		Type.Number({
			description: 'How long to wait for the reloaded app to reconnect, in milliseconds.',
		}),
		60_000,
	),
	port: bridgePortField,
});

const reloadCommand: CommandDefinition<typeof schema> = {
	name: 'reload',
	description:
		'Reload the JavaScript bundle on the connected device and wait until the fresh bundle ' +
		'reconnects to the debugger. The fresh bundle is told apart by a token the old one carried.',
	summary: 'Reload the JavaScript bundle and wait for it to reconnect.',
	mcp: true,
	schema,
	handler: lazyHandler(() => import('./reload-handler')),
};

export default reloadCommand;
