import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { waitForDevice } from '~/lib/context';
import { formatResult } from '~/lib/format';

const schema = z.object({
	code: z.string().describe('The JavaScript to evaluate on the device.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const evalCommand: CommandDefinition<typeof schema> = {
	name: 'eval',
	description:
		'Evaluate JavaScript inside the running Unbound client on the connected device and return ' +
		'its result plus any console output the code produced. Use this to inspect the live runtime: ' +
		'read globals (e.g. `unbound.metro`), call APIs, and probe Discord internals. The last ' +
		'expression is the return value; `console.log`/`warn`/`error` are captured separately.',
	surfaces: { cli: true, mcp: true },
	schema,
	cli: { positionals: ['code'] },
	async handler({ code }, { client }) {
		await waitForDevice(client);

		if (!client.isDeviceConnected) {
			return {
				ok: false,
				text: 'No device is connected to the debugger. Launch the app so its debugger dials the bridge, then retry.',
			};
		}

		const result = await client.evaluate(code);

		return { ok: result.ok, text: formatResult(result), data: result };
	},
};

export default evalCommand;
