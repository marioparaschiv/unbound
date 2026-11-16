import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	name: Type.String({
		minLength: 1,
		description:
			'The slash command, with subcommands after a space: `petpet` or `"convert usd"`.',
	}),
	options: defaulted(
		Type.Array(Type.String(), {
			description: 'The command options as `name=value`, such as `user=1234` or `amount=5`.',
		}),
		[],
	),
	channel: Type.Optional(
		Type.String({
			description: 'The channel id to run it in; the channel open on the device by default.',
		}),
	),
	port: bridgePortField,
});

const commandCommand: CommandDefinition<typeof schema> = {
	name: 'command',
	description:
		"Run a slash command from Discord's `/` list on the connected device, as the picker would, " +
		'without sending its reply: a public reply is printed here instead, and an ephemeral one shows ' +
		'only on the device. Commands that send messages themselves still send them.',
	summary: 'Run a slash command on the device without sending it.',
	mcp: true,
	schema,
	cli: { positionals: ['name', 'options'] },
	handler: lazyHandler(() => import('./command-handler')),
};

export default commandCommand;
