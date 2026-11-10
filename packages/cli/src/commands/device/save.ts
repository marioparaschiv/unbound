import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { deviceTargetFields } from './target-fields';
import { saveSnapshot } from '~/lib/device-state';
import { Type } from '~/lib/schema';

const schema = Type.Object({
	name: Type.String({ description: 'The snapshot to save.' }),
	...deviceTargetFields,
});

const saveCommand: CommandDefinition<typeof schema> = {
	name: 'save',
	description:
		"Copy Discord's Unbound folder off a rooted Android device or a jailbroken iPhone as a named " +
		'snapshot on this computer, to put back later with `restore`.',
	summary: "Snapshot the device's Unbound state to this computer.",
	mcp: true,
	schema,
	cli: { positionals: ['name'] },
	handler({ name, ...options }) {
		return saveSnapshot(name, options);
	},
};

export default saveCommand;
