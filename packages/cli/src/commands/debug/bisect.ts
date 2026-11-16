import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	step: defaulted(
		Type.Union(
			[
				Type.Literal('start'),
				Type.Literal('yes'),
				Type.Literal('no'),
				Type.Literal('stop'),
				Type.Literal('status'),
			],
			{
				description:
					'`start` turns every plugin off for a first check; `yes` means the problem still happens with the plugins now on, `no` that it is gone; `stop` turns the plugins back on; `status` prints the round.',
			},
		),
		'status',
	),
	port: bridgePortField,
});

const bisectCommand: CommandDefinition<typeof schema> = {
	name: 'bisect',
	description:
		'Find the plugin that causes a problem on the connected device by turning plugins off in halves: ' +
		'start, reproduce the problem, answer yes or no until one plugin is left. The state survives restarts, ' +
		'for problems that happen at launch, and every plugin but the culprit comes back on at the end.',
	summary: 'Find the plugin causing a problem by halving.',
	mcp: true,
	schema,
	cli: { positionals: ['step'] },
	handler: lazyHandler(() => import('./bisect-handler')),
};

export default bisectCommand;
