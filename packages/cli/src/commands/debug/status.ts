import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	port: bridgePortField,
	watch: defaulted(
		Type.Boolean({
			description:
				'Sample the native resources repeatedly and report which ones keep growing.',
		}),
		false,
	),
	interval: defaulted(
		Type.Number({ description: 'Milliseconds between samples when watching.' }),
		5_000,
	),
	samples: defaulted(Type.Number({ description: 'How many samples to take when watching.' }), 12),
});

const statusCommand: CommandDefinition<typeof schema> = {
	name: 'status',
	description:
		'Show the device attached to the debugger bridge, its Discord, loader and client versions, how ' +
		'many plugins started, and the native hooks, surfaces and handles it holds after a garbage collection.',
	summary: 'Show the connected device, its versions and native resources.',
	mcp: true,
	schema,
	handler: lazyHandler(() => import('./status-handler')),
};

export default statusCommand;
