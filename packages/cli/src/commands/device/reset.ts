import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { openDeviceTarget } from '~/lib/device-target';
import { resetDevice } from '~/lib/device-state';
import { Type } from '~/lib/schema';

import { deviceTargetFields } from './target-fields';

const schema = Type.Object(deviceTargetFields);

const resetCommand: CommandDefinition<typeof schema> = {
	name: 'reset',
	description:
		"Move Discord's Unbound folder aside on a rooted Android device or a jailbroken iPhone, so Discord " +
		'starts fresh. Nothing is deleted: the old folder stays beside the new one.',
	summary: 'Move Unbound aside so Discord starts fresh.',
	mcp: true,
	schema,
	async handler({ serial, ios, udid, restart }) {
		const target = await openDeviceTarget({ serial, ios, udid });

		if ('error' in target) {
			return { ok: false, text: target.error };
		}

		return resetDevice(target, { restart });
	},
};

export default resetCommand;
