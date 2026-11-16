import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { lazyHandler } from '~/lib/lazy-handler';
import { Type } from '~/lib/schema';

import { deviceTargetFields } from './target-fields';

const schema = Type.Object({
	local: Type.String({ minLength: 1, description: 'The file or folder on this computer.' }),
	path: Type.String({
		minLength: 1,
		description:
			"Where it goes in Discord's data, relative to the folder that holds `Unbound` (such as `Unbound/Plugins/x/settings.json`), or absolute.",
	}),
	...deviceTargetFields,
});

const pushCommand: CommandDefinition<typeof schema> = {
	name: 'push',
	description:
		"Copy a file or folder from this computer into Discord's data on a rooted Android device (adb " +
		"as root) or a jailbroken iPhone (jb-p1lot), creating its folders and giving it Discord's " +
		'owner. A folder is unpacked over the target. Pass `restart` to relaunch Discord afterwards.',
	summary: "Copy a file or folder into Discord's data on the device.",
	mcp: true,
	schema,
	cli: { positionals: ['local', 'path'] },
	handler: lazyHandler(() => import('./push-handler')),
};

export default pushCommand;
