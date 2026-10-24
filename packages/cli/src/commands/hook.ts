import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';
import { DEFAULT_BRIDGE_PORT } from '@unbound-app/debugger-protocol';
import { z } from 'zod';

import { runOnDevice, toDeviceCode } from '~/lib/device';
import { captureNativeHook } from '~/lib/probes';

const schema = z.object({
	className: z.string().describe('The class that declares or inherits the method.'),
	method: z.string().describe('The Java method name, or the Objective-C selector.'),
	parameters: z
		.array(z.string())
		.default([])
		.describe('The Java parameter type names, such as int or android.view.MotionEvent.'),
	duration: z.number().default(3000).describe('How long to record calls, in milliseconds.'),
	samples: z.number().default(10).describe('How many calls to describe.'),
	port: z
		.number()
		.default(DEFAULT_BRIDGE_PORT)
		.describe('The port the debugger bridge listens on.'),
});

const hookCommand: CommandDefinition<typeof schema> = {
	name: 'hook',
	description:
		'Record calls to a native method on the connected device for a while and describe the first ' +
		'ones: an Android Java method, or an iOS Objective-C selector. Use it to learn when Discord ' +
		'binds, lays out or redraws a view before writing a plugin hook. Pick a method of a specific ' +
		'class: hooking one every view calls, such as UIView layoutSubviews, can crash the app. ' +
		'The device evaluation times ' +
		'out after ten seconds, so keep the duration below that.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['className', 'method'] },
	handler({ className, method, parameters, duration, samples }, { client }) {
		return runOnDevice(
			client,
			toDeviceCode(captureNativeHook, className, method, parameters, duration, samples),
		);
	},
};

export default hookCommand;
