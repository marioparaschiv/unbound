import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { Type } from '~/lib/schema';

const schema = Type.Object({
	message: Type.Optional(
		Type.String({
			description: "The message's id; the newest message in the open chat by default.",
		}),
	),
	port: bridgePortField,
});

const rowsCommand: CommandDefinition<typeof schema> = {
	name: 'rows',
	description:
		"Print the chat row Discord generates for a message in the open chat, after every plugin's patches: " +
		'its name colors, content nodes, attachments, embeds and the rest the native chat draws from. ' +
		'Redraws the open chat to capture it.',
	summary: 'Print the chat row data Discord draws a message from.',
	mcp: true,
	schema,
	cli: { positionals: ['message'] },
	handler: lazyHandler(() => import('./rows-handler')),
};

export default rowsCommand;
