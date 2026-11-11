import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { openDeviceTarget } from '~/lib/device-target';
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
	async handler({ name, serial, ios, udid, restart }) {
		const target = await openDeviceTarget({ serial, ios, udid });

		if ('error' in target) {
			return { ok: false, text: target.error };
		}

		return restoreSnapshot(name, target, { restart });
	},
};

export default restoreCommand;
