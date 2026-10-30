import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { z } from 'zod';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { bridgePortField } from '~/lib/context';
import { searchModules } from '~/lib/probes';

const schema = z.object({
	pattern: z
		.string()
		.describe('A case-insensitive regular expression for file paths or export names.'),
	max: z.number().default(40).describe('How many modules to list.'),
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
