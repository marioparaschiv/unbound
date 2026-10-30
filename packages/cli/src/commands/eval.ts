import { DEFAULT_EVAL_TIMEOUT_MS, MAX_EVAL_TIMEOUT_MS } from '@unbound-app/debugger-protocol';
import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { z } from 'zod';

import { bridgePortField } from '~/lib/context';
import { runOnDevice } from '~/lib/device';

const schema = z.object({
	code: z.string().describe('The JavaScript to evaluate on the device.'),
	port: bridgePortField,
	timeout: z
		.number()
		.int()
		.positive()
		.max(MAX_EVAL_TIMEOUT_MS)
		.optional()
		.describe(
			`How long to wait for the result, in milliseconds. Defaults to the bridge's ${DEFAULT_EVAL_TIMEOUT_MS}ms.`,
		),
});

const evalCommand: CommandDefinition<typeof schema> = {
	name: 'eval',
	description:
		'Evaluate JavaScript inside the running Unbound client on the connected device and return ' +
		'its result plus any console output the code produced. Use this to inspect the live runtime: ' +
		'read globals (e.g. `unbound.metro`), call APIs, and probe Discord internals. The last ' +
		'expression is the return value, and a returned promise is awaited for its resolved value; ' +
		'`console.log`/`warn`/`error` are captured separately. Pass `timeout` for long-running code.',
	summary: 'Run JavaScript on the connected device.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['code'] },
	handler({ code, timeout }, { client }) {
		return runOnDevice(client, code, timeout);
	},
};

export default evalCommand;
