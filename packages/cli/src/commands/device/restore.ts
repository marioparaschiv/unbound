import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { restoreSnapshot } from '~/lib/device-state';
import { Type } from '~/lib/schema';

import { deviceTargetFields } from './target-fields';

const schema = Type.Object({
	name: Type.String({ description: 'The snapshot to restore.' }),
	...deviceTargetFields,
});

const restoreCommand: CommandDefinition<typeof schema> = {
	name: 'restore',
	description:
		"Replace Discord's Unbound folder on a rooted Android device or a jailbroken iPhone with a snapshot " +
		'`save` took. The replaced folder stays on the device.',
	summary: 'Put a saved snapshot back on the device.',
	mcp: true,
	schema,
	cli: { positionals: ['name'] },
	handler({ name, ...options }) {
		return restoreSnapshot(name, options);
	},
};

export default restoreCommand;
