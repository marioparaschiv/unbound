import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { viewTree } from '~/lib/probes';

const schema = z.object({
	filter: z
		.string()
		.default('')
		.describe('Keep only views whose class name contains this text, plus their ancestors.'),
	depth: z
		.number()
		.default(40)
		.describe('How deep to print below each view; iOS caps this at 12 levels.'),
	max: z.number().default(1500).describe('How many views to visit at most.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const viewsCommand: CommandDefinition<typeof schema> = {
	name: 'views',
	description:
		'Print the native view tree of the connected device: Android views from the current ' +
		"activity, iOS views from every visible window, with each view's size, visibility, text and handle. " +
		'Use it to find where a plugin should hook or place its views. It reads views through a running ' +
		'plugin that holds native view access.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['filter'] },
	handler({ filter, depth, max }, { client }) {
		return runOnDevice(client, toDeviceCode(viewTree, filter, depth, max));
	},
};

export default viewsCommand;
