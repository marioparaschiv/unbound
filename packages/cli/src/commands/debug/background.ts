import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { Type } from '~/lib/schema';

const schema = Type.Object({
	run: Type.Optional(
		Type.Boolean({
			description:
				'Run every background job now, past the loader’s 30-minute spacing, and print how each went.',
		}),
	),
	port: bridgePortField,
});

const backgroundCommand: CommandDefinition<typeof schema> = {
	name: 'background',
	description:
		"Print the background refresh on the connected device: the loader's spacing (last run, when the next is due), " +
		'the registered jobs with the plugins that added them, and how each job went in the last run.',
	summary: 'Show or run the background refresh jobs.',
	mcp: true,
	schema,
	handler: lazyHandler(() => import('./background-handler')),
};

export default backgroundCommand;
