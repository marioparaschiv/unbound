import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { textSpans } from '~/lib/probes';

const schema = z.object({
	match: z.string().describe('Text the text views must contain.'),
	max: z.number().default(5).describe('How many matching text views to print.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const spansCommand: CommandDefinition<typeof schema> = {
	name: 'spans',
	description:
		'Print the text and spans of the Android text views that contain some text, with each ' +
		"span's class and range and the text's invisible characters escaped. Use it to see how Discord " +
		'renders mentions, code blocks and links before a plugin rewrites them.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['match'] },
	handler({ match, max }, { client }) {
		return runOnDevice(client, toDeviceCode(textSpans, match, max));
	},
};

export default spansCommand;
