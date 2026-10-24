import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { traceFunction } from '~/lib/probes';

const schema = z.object({
	props: z
		.array(z.string())
		.min(1)
		.describe('Props of the module to find; the first is the function to trace.'),
	duration: z.number().default(3000).describe('How long to record calls, in milliseconds.'),
	samples: z.number().default(10).describe('How many calls to describe.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const traceCommand: CommandDefinition<typeof schema> = {
	name: 'trace',
	description:
		"Record calls to a JavaScript function of one of Discord's modules for a while, such as " +
		'generateMessageRowData, summarising the arguments and result of the first calls. The device ' +
		'evaluation times out after ten seconds, so keep the duration below that.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['props'] },
	handler({ props, duration, samples }, { client }) {
		return runOnDevice(client, toDeviceCode(traceFunction, props, duration, samples));
	},
};

export default traceCommand;
