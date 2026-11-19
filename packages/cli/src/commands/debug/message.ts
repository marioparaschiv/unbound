import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	action: Type.Union([Type.Literal('add'), Type.Literal('remove')], {
		description: '`add` shows a new local message; `remove` takes local messages away.',
	}),
	content: defaulted(Type.String({ description: 'The text of the message to add.' }), ''),
	channel: Type.Optional(
		Type.String({ description: 'The channel id; the channel open on the device by default.' }),
	),
	author: defaulted(
		Type.String({ description: 'Who wrote it: `me`, `clyde`, or a user id the device knows.' }),
		'me',
	),
	attachment: Type.Optional(
		Type.String({ description: 'A URL to show as the message attachment, such as an image.' }),
	),
	delay: defaulted(
		Type.Number({
			description:
				'With `add`, how many milliseconds late the message arrives: its nonce is backdated by this much, so latency badges show it.',
			minimum: 0,
		}),
		0,
	),
	state: defaulted(
		Type.Union([Type.Literal('sent'), Type.Literal('sending'), Type.Literal('failed')], {
			description: 'How far the message got: `sent`, `sending` or `failed`.',
		}),
		'sent',
	),
	ids: defaulted(
		Type.Array(Type.String(), {
			description:
				'With `remove`, the message ids; all messages this command added in the channel when empty.',
		}),
		[],
	),
	port: bridgePortField,
});

const messageCommand: CommandDefinition<typeof schema> = {
	name: 'message',
	description:
		'Add or remove a message that exists only on the connected device, for checking how a plugin ' +
		'renders one: choose the author, text, an attachment URL, how late it arrives and whether it shows ' +
		"as sent, sending or failed. Nothing reaches Discord's servers. Prints the channel and message ids.",
	summary: 'Add or remove a local message on the device.',
	mcp: true,
	schema,
	cli: { positionals: ['action', 'content'] },
	handler: lazyHandler(() => import('./message-handler')),
};

export default messageCommand;
