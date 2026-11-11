import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';
import { textSpans } from '~/lib/probes';

const schema = Type.Object({
	match: Type.String({ description: 'Text the text views must contain.' }),
	max: defaulted(Type.Number({ description: 'How many matching text views to print.' }), 5),
	port: bridgePortField,
});

const spansCommand: CommandDefinition<typeof schema> = {
	name: 'spans',
	description:
		'Print the text and spans of the Android text views that contain some text, with each ' +
		"span's class and range and the text's invisible characters escaped. Use it to see how Discord " +
		'renders mentions, code blocks and links before a plugin rewrites them.',
	summary: 'Print the spans of Android text views.',
	mcp: true,
	schema,
	cli: { positionals: ['match'] },
	handler({ match, max }, { client }) {
		return runOnDevice(client, toDeviceCode(textSpans, match, max));
	},
};

export default spansCommand;
