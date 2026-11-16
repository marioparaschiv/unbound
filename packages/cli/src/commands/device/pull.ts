import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { Type } from '~/lib/schema';

import { deviceTargetFields } from './target-fields';

const { restart: _restart, ...pickDevice } = deviceTargetFields;

const schema = Type.Object({
	path: Type.String({
		minLength: 1,
		description:
			"The file or folder in Discord's data, relative to the folder that holds `Unbound` (such as `Unbound/Logs/unbound.log`), or absolute.",
	}),
	local: Type.Optional(
		Type.String({
			description: 'Where to write it here; its name in the current folder by default.',
		}),
	),
	...pickDevice,
});

const pullCommand: CommandDefinition<typeof schema> = {
	name: 'pull',
	description:
		"Copy a file or folder out of Discord's data on a rooted Android device (adb as root) or a " +
		'jailbroken iPhone (jb-p1lot) to this computer. Relative paths start in the folder that holds ' +
		'`Unbound`, so one path works on both platforms.',
	summary: "Copy a file or folder from Discord's data to this computer.",
	mcp: true,
	schema,
	cli: { positionals: ['path', 'local'] },
	handler: lazyHandler(() => import('./pull-handler')),
};

export default pullCommand;
