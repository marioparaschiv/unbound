import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

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
	summary: "Search Discord's Metro modules by path or export.",
	mcp: true,
	schema,
	cli: { positionals: ['pattern'] },
	handler: lazyHandler(() => import('./modules-handler')),
};

export default modulesCommand;
