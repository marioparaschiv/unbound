import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	props: Type.Array(Type.String(), {
		minItems: 1,
		description: 'Props of the module to find; the first is the function to trace.',
	}),
	duration: defaulted(
		Type.Number({ description: 'How long to record calls, in milliseconds.' }),
		3000,
	),
	samples: defaulted(Type.Number({ description: 'How many calls to describe.' }), 10),
	port: bridgePortField,
});

const traceCommand: CommandDefinition<typeof schema> = {
	name: 'trace',
	description:
		"Record calls to a JavaScript function of one of Discord's modules for a while, such as " +
		'generateMessageRowData, summarising the arguments and result of the first calls.',
	summary: "Record calls to a Discord module's function.",
	mcp: true,
	schema,
	cli: { positionals: ['props'] },
	handler: lazyHandler(() => import('./trace-handler')),
};

export default traceCommand;
