import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';
import { measureTiming } from '~/lib/probes';

const schema = Type.Object({
	rounds: defaulted(Type.Number({ description: 'How many samples to take.' }), 3),
	port: bridgePortField,
});

const timingCommand: CommandDefinition<typeof schema> = {
	name: 'timing',
	description:
		'Measure how long a zero-delay JavaScript timer and a native main-thread round trip take on the ' +
		'connected device right now. Large numbers mean the JavaScript thread is busy, for instance with ' +
		'plugin work during a cold start.',
	summary: 'Measure JavaScript and main-thread latency.',
	mcp: true,
	schema,
	handler({ rounds }, { client }) {
		return runOnDevice(client, toDeviceCode(measureTiming, rounds));
	},
};

export default timingCommand;
