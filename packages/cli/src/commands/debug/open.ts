import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	screen: Type.String({
		minLength: 1,
		description:
			'The settings screen to open: a `Screens` key such as `Marketplace` or `Plugins`, or any `SETTING_RENDERER_CONFIG` route key.',
	}),
	params: defaulted(
		Type.String({
			description:
				'Route parameters for the screen, as a JSON object, e.g. `{"kind":"theme"}`.',
		}),
		'{}',
	),
	port: bridgePortField,
});

const openCommand: CommandDefinition<typeof schema> = {
	name: 'open',
	description:
		'Open an Unbound (or Discord) settings screen on the connected device from anywhere in the ' +
		'app, through the root navigation ref. Prints the route key it opened.',
	summary: 'Open a settings screen on the device.',
	mcp: true,
	schema,
	cli: { positionals: ['screen'] },
	handler: lazyHandler(() => import('./open-handler')),
};

export default openCommand;
