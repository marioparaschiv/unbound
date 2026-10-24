import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { measureTiming } from '~/lib/probes';

const schema = z.object({
	rounds: z.number().default(3).describe('How many samples to take.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const timingCommand: CommandDefinition<typeof schema> = {
	name: 'timing',
	description:
		'Measure how long a zero-delay JavaScript timer and a native main-thread round trip take on the ' +
		'connected device right now. Large numbers mean the JavaScript thread is busy, for instance with ' +
		'plugin work during a cold start.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	handler({ rounds }, { client }) {
		return runOnDevice(client, toDeviceCode(measureTiming, rounds));
	},
};

export default timingCommand;
