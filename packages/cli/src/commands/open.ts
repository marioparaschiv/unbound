import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import toError from '@unbound-app/utils/to-error';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { defaulted, parse, Type } from '~/lib/schema';
import type { ScreenParams } from '~/lib/navigation';
import { bridgePortField } from '~/lib/context';
import { openScreen } from '~/lib/navigation';

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

const paramsSchema = Type.Record(
	Type.String(),
	Type.Union([Type.String(), Type.Number(), Type.Boolean(), Type.Null()]),
);

const openCommand: CommandDefinition<typeof schema> = {
	name: 'open',
	description:
		'Open an Unbound (or Discord) settings screen on the connected device from anywhere in the ' +
		'app, through the root navigation ref. Prints the route key it opened.',
	surfaces: { cli: 'mcp', mcp: true },
	schema,
	cli: { positionals: ['screen'] },
	async handler({ screen, params }, { client }) {
		let parsed: ScreenParams;

		try {
			parsed = parse(paramsSchema, JSON.parse(params));
		} catch (error) {
			return {
				ok: false,
				text: `params must be a JSON object of plain values: ${toError(error).message}`,
			};
		}

		return runOnDevice(client, toDeviceCode(openScreen, screen, parsed));
	},
};

export default openCommand;
