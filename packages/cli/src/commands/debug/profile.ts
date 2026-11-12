import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	duration: defaulted(
		Type.Integer({
			minimum: 1,
			maximum: 60_000,
			description: 'How long to sample the JavaScript thread, in milliseconds.',
		}),
		5000,
	),
	top: defaulted(
		Type.Integer({ minimum: 1, description: 'How many functions and sources to list.' }),
		20,
	),
	out: defaulted(
		Type.String({
			description:
				'Also save the raw Chrome trace here, to open in Perfetto or chrome://tracing.',
		}),
		'',
	),
	port: bridgePortField,
});

const profileCommand: CommandDefinition<typeof schema> = {
	name: 'profile',
	description:
		"Sample the connected device's JavaScript thread with Hermes' sampling profiler for a while, " +
		'then rank the functions and sources it spent the time in. Scroll or open the screen to measure ' +
		'while it records. `--out` also saves the raw trace.',
	summary: 'Sample the JavaScript thread and rank where time went.',
	mcp: true,
	schema,
	handler: lazyHandler(() => import('./profile-handler')),
};

export default profileCommand;
