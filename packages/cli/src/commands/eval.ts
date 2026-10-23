import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { runOnDevice } from '~/lib/device';

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
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['code'] },
	handler({ code }, { client }) {
		return runOnDevice(client, code);
	},
};

export default evalCommand;
