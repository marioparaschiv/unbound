import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';
import { traceFunction } from '~/lib/probes';

const schema = Type.Object({
	props: Type.Array(Type.String(), {
		minItems: 1,
		description: 'Props of the module to find; the first is the function to trace.',
	}),
	duration: defaulted(
		Type.Number({ description: 'How long to record calls, in milliseconds.' }),
		3000,
	),
	samples: defaulted(Type.Number({ description: 'How many calls to describe.' }), 10),
	port: bridgePortField,
});

const traceCommand: CommandDefinition<typeof schema> = {
	name: 'trace',
	description:
		"Record calls to a JavaScript function of one of Discord's modules for a while, such as " +
		'generateMessageRowData, summarising the arguments and result of the first calls. The device ' +
		'evaluation times out after ten seconds, so keep the duration below that.',
	summary: "Record calls to a Discord module's function.",
	mcp: true,
	schema,
	cli: { positionals: ['props'] },
	handler({ props, duration, samples }, { client }) {
		return runOnDevice(client, toDeviceCode(traceFunction, props, duration, samples));
	},
};

export default traceCommand;
