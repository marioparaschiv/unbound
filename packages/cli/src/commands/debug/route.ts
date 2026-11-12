import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { Type } from '~/lib/schema';

const schema = Type.Object({
	port: bridgePortField,
});

const routeCommand: CommandDefinition<typeof schema> = {
	name: 'route',
	description:
		'Print the focused navigation route on the connected device: its name, its params, and the ' +
		'navigator path leading to it.',
	summary: 'Print the focused navigation route.',
	mcp: true,
	schema,
	handler: lazyHandler(() => import('./route-handler')),
};

export default routeCommand;
