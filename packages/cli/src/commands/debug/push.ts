import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	addon: defaulted(
		Type.String({
			description: 'The plugin or theme to push, as its manifest id or directory.',
		}),
		'.',
	),
	build: defaulted(Type.Boolean({ description: 'Build the addon before pushing it.' }), true),
	port: bridgePortField,
});

const pushCommand: CommandDefinition<typeof schema> = {
	name: 'push',
	description:
		'Build one plugin or theme and hot-reload it in the running client on the connected device, installing ' +
		'it when the device does not have it yet. Use this to try a change on a specific device.',
	summary: 'Build an addon and hot-reload it on the device.',
	mcp: true,
	schema,
	cli: { positionals: ['addon'] },
	handler: lazyHandler(() => import('./push-handler')),
};

export default pushCommand;
