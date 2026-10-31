import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import toError from '@unbound-app/utils/to-error';
import { z } from 'zod';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import type { ScreenParams } from '~/lib/navigation';
import { bridgePortField } from '~/lib/context';
import { openScreen } from '~/lib/navigation';

const schema = z.object({
	screen: z
		.string()
		.min(1)
		.describe(
			'The settings screen to open: a `Screens` key such as `Marketplace` or `Plugins`, or any ' +
				'`SETTING_RENDERER_CONFIG` route key.',
		),
	params: z
		.string()
		.default('{}')
		.describe('Route parameters for the screen, as a JSON object, e.g. `{"kind":"theme"}`.'),
	port: bridgePortField,
});

const paramsSchema = z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()]));

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
			parsed = paramsSchema.parse(JSON.parse(params));
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
