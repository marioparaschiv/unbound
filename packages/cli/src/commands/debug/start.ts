import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { Type } from '~/lib/schema';

const schema = Type.Object({
	port: bridgePortField,
});

const startCommand: CommandDefinition<typeof schema> = {
	name: 'start',
	description:
		'Start the debugger bridge in the background when none is listening; a running bridge is kept. ' +
		'Its log goes to the system temporary directory.',
	summary: 'Start the debugger bridge in the background.',
	mcp: false,
	schema,
	handler: lazyHandler(() => import('./start-handler')),
};

export default startCommand;
