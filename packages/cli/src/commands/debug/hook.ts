import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { bridgePortField } from '~/lib/context';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	className: Type.String({ description: 'The class that declares or inherits the method.' }),
	method: Type.String({ description: 'The Java method name, or the Objective-C selector.' }),
	parameters: defaulted(
		Type.Array(Type.String(), {
			description: 'The Java parameter type names, such as int or android.view.MotionEvent.',
		}),
		[],
	),
	duration: defaulted(
		Type.Number({ description: 'How long to record calls, in milliseconds.' }),
		3000,
	),
	samples: defaulted(Type.Number({ description: 'How many calls to describe.' }), 10),
	port: bridgePortField,
});

const hookCommand: CommandDefinition<typeof schema> = {
	name: 'hook',
	description:
		'Record calls to a native method on the connected device for a while and describe the first ' +
		'ones: an Android Java method, or an iOS Objective-C selector. Use it to learn when Discord ' +
		'binds, lays out or redraws a view before writing a plugin hook. Pick a method of a specific ' +
		'class: hooking one every view calls, such as UIView layoutSubviews, can crash the app.',
	summary: 'Record calls to a native method.',
	mcp: true,
	schema,
	cli: { positionals: ['className', 'method'] },
	handler: lazyHandler(() => import('./hook-handler')),
};

export default hookCommand;
