import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { currentRoute } from '~/lib/navigation';

const schema = z.object({
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const routeCommand: CommandDefinition<typeof schema> = {
	name: 'route',
	description:
		'Print the focused navigation route on the connected device: its name, its params, and the ' +
		'navigator path leading to it.',
	surfaces: { cli: 'mcp', mcp: true },
	schema,
	handler(_input, { client }) {
		return runOnDevice(client, toDeviceCode(currentRoute));
	},
};

export default routeCommand;
