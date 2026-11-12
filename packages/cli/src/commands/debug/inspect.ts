import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { MAX_EVAL_TIMEOUT_MS } from '@unbound-app/debugger-protocol';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const WALK_TIMEOUT_MS = 60_000;

const schema = Type.Object({
	what: Type.Enum(['class', 'views', 'find'], {
		description: 'What to inspect: class, views or find.',
	}),
	name: defaulted(
		Type.String({ description: 'The class to describe (class) or to look for (find).' }),
		'',
	),
	class: defaulted(
		Type.String({
			description: 'For views: dump only the subtrees of attached views of this class.',
		}),
		'',
	),
	depth: defaulted(
		Type.Integer({ minimum: 1, description: 'For views: how deep to print.' }),
		40,
	),
	max: defaulted(
		Type.Integer({ minimum: 1, description: 'How many views to visit at most.' }),
		2000,
	),
	filter: defaulted(
		Type.String({
			description:
				'For class: keep only constructors, methods and fields whose name contains this.',
		}),
		'',
	),
	port: bridgePortField,
	timeout: defaulted(
		Type.Integer({
			minimum: 1,
			maximum: MAX_EVAL_TIMEOUT_MS,
			description: 'How long the device may take, in milliseconds.',
		}),
		WALK_TIMEOUT_MS,
	),
});

const inspectCommand: CommandDefinition<typeof schema> = {
	name: 'inspect',
	description:
		'Inspect native code on the connected device. `class <name>` describes a Java class: its ' +
		'superclasses, constructors, methods with static markers and fields (iOS: the superclass chain). ' +
		"`views [--class <name>] [--depth n]` dumps the current activity's view tree with class names, " +
		'resource ids, sizes, visibility and text. `find <class>` lists the attached views of a class. ' +
		'It reads through a running plugin that holds native access.',
	summary: 'Describe a Java class, or walk or find native views.',
	mcp: true,
	schema,
	cli: { positionals: ['what', 'name'] },
	handler: lazyHandler(() => import('./inspect-handler')),
};

export default inspectCommand;
