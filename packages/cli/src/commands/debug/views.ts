import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';
import { viewTree } from '~/lib/probes';

const schema = Type.Object({
	filter: defaulted(
		Type.String({
			description:
				'Keep only views whose class name contains this text, plus their ancestors.',
		}),
		'',
	),
	depth: defaulted(
		Type.Number({
			description: 'How deep to print below each view; iOS caps this at 12 levels.',
		}),
		40,
	),
	max: defaulted(Type.Number({ description: 'How many views to visit at most.' }), 1500),
	port: bridgePortField,
});

const viewsCommand: CommandDefinition<typeof schema> = {
	name: 'views',
	description:
		'Print the native view tree of the connected device: Android views from the current ' +
		"activity, iOS views from every visible window, with each view's size, visibility, text and handle. " +
		'Use it to find where a plugin should hook or place its views. It reads views through a running ' +
		'plugin that holds native view access.',
	summary: 'Print the native view tree.',
	mcp: true,
	schema,
	cli: { positionals: ['filter'] },
	handler({ filter, depth, max }, { client }) {
		return runOnDevice(client, toDeviceCode(viewTree, filter, depth, max));
	},
};

export default viewsCommand;
