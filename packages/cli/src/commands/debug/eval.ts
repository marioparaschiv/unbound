import { DEFAULT_EVAL_TIMEOUT_MS, MAX_EVAL_TIMEOUT_MS } from '@unbound-app/debugger-protocol';
import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	code: Type.Optional(
		Type.String({
			description: 'The JavaScript to evaluate on the device; `-` reads it from stdin.',
		}),
	),
	file: Type.Optional(
		Type.String({
			description: 'A JavaScript file on this computer to evaluate instead of `code`.',
		}),
	),
	native: defaulted(
		Type.Boolean({
			description:
				'Give the code a `native` variable: a native bridge with every capability, kept for the debugger session. Development builds only.',
		}),
		false,
	),
	port: bridgePortField,
	timeout: Type.Optional(
		Type.Integer({
			minimum: 1,
			maximum: MAX_EVAL_TIMEOUT_MS,
			description: `How long to wait for the result, in milliseconds. Defaults to the bridge's ${DEFAULT_EVAL_TIMEOUT_MS}ms.`,
		}),
	),
});

const evalCommand: CommandDefinition<typeof schema> = {
	name: 'eval',
	description:
		'Evaluate JavaScript inside the running Unbound client on the connected device and return ' +
		'its result plus any console output the code produced. Use this to inspect the live runtime: ' +
		'read globals (e.g. `unbound.metro`), call APIs, and probe Discord internals. The last ' +
		'expression is the return value, a returned promise is awaited for its resolved value, and ' +
		'top-level `await` works; pass `file` to run a script from disk. ' +
		'`console.log`/`warn`/`error` are captured separately. Pass `timeout` for long-running code.',
	summary: 'Run JavaScript on the connected device.',
	mcp: true,
	schema,
	cli: { positionals: ['code'] },
	handler: lazyHandler(() => import('./eval-handler')),
};

export default evalCommand;
