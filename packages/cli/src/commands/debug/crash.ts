import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

export const CRASH_KINDS = ['js', 'abort', 'segv', 'hang', 'objc-exception'] as const;

const schema = Type.Object({
	kind: Type.Union(
		CRASH_KINDS.map((kind) => Type.Literal(kind)),
		{
			description:
				'What to trigger: `js` an uncaught JavaScript error, `abort` SIGABRT, `segv` SIGSEGV, `hang` a blocked main thread, `objc-exception` an uncaught NSException (iOS).',
		},
	),
	seconds: defaulted(
		Type.Integer({
			minimum: 1,
			maximum: 60,
			description: 'How long `hang` blocks the main thread.',
		}),
		8,
	),
	port: bridgePortField,
});

const crashCommand: CommandDefinition<typeof schema> = {
	name: 'crash',
	description:
		'Crash or freeze Discord on the connected device on purpose, to check that the loader records it and the next ' +
		'launch reports it. Development builds only; `hang` returns once the main thread is free again.',
	summary: 'Trigger a crash or freeze on the device.',
	mcp: true,
	schema,
	cli: { positionals: ['kind'] },
	handler: lazyHandler(() => import('./crash-handler')),
};

export default crashCommand;
