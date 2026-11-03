import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';
import { searchModules } from '~/lib/probes';

const schema = Type.Object({
	pattern: Type.String({
		description: 'A case-insensitive regular expression for file paths or export names.',
	}),
	max: defaulted(Type.Number({ description: 'How many modules to list.' }), 40),
	port: bridgePortField,
});

const modulesCommand: CommandDefinition<typeof schema> = {
	name: 'modules',
	description:
		"Search the client's Metro modules by tracked file path or export name and list each match " +
		'with its id, whether it has loaded yet and its exports. Run it against both platforms to see ' +
		'why a lookup finds a module on one and not the other.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['pattern'] },
	handler({ pattern, max }, { client }) {
		return runOnDevice(client, toDeviceCode(searchModules, pattern, max));
	},
};

export default modulesCommand;
