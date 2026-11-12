import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	addon: defaulted(
		Type.String({ description: 'The plugin to install, as its manifest id or directory.' }),
		'.',
	),
	build: defaulted(Type.Boolean({ description: 'Build the plugin before installing it.' }), true),
	serial: Type.Optional(
		Type.String({
			description: 'The adb serial of the Android device, when several are attached.',
		}),
	),
	ios: defaulted(
		Type.Boolean({
			description: 'Install on a jailbroken iPhone through jb-p1lot instead of over adb.',
		}),
		false,
	),
	udid: Type.Optional(
		Type.String({
			description: 'The UDID of the iPhone, when several are connected. Implies --ios.',
		}),
	),
	restart: defaulted(
		Type.Boolean({ description: 'Restart Discord afterwards so it loads the plugin.' }),
		false,
	),
});

const installCommand: CommandDefinition<typeof schema> = {
	name: 'install',
	description:
		"Build one plugin and copy it into Discord's plugin folder on a rooted Android device or " +
		'emulator over adb, or on a jailbroken iPhone through jb-p1lot, so the next cold start loads ' +
		'it. Pass `restart` to relaunch Discord right away. Use `ubd debug push` to hot-reload instead.',
	summary: 'Copy a plugin into Discord for the next cold start.',
	mcp: true,
	schema,
	cli: { positionals: ['addon'] },
	handler: lazyHandler(() => import('./install-handler')),
};

export default installCommand;
