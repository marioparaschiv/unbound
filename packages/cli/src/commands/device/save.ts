import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { openDeviceTarget } from '~/lib/device-target';
import { saveSnapshot } from '~/lib/device-state';
import { Type } from '~/lib/schema';

import { deviceTargetFields } from './target-fields';

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
	async handler({ name, serial, ios, udid }) {
		const target = await openDeviceTarget({ serial, ios, udid });

		if ('error' in target) {
			return { ok: false, text: target.error };
		}

		return saveSnapshot(name, target);
	},
};

export default saveCommand;
