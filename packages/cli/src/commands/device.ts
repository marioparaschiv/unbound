import type { CommandDefinition } from '@unbound-app/debugger-protocol/registry';

import { listSnapshots, resetDevice, restoreSnapshot, saveSnapshot } from '~/lib/device-state';
import { openDeviceTarget } from '~/lib/device-target';
import { defaulted, Type } from '~/lib/schema';

const schema = Type.Object({
	action: Type.Enum(['reset', 'save', 'restore', 'list'], {
		description:
			'reset moves Unbound aside for a fresh start, save and restore snapshots, list shows them.',
	}),
	name: defaulted(Type.String({ description: 'The snapshot to save or restore.' }), ''),
	serial: Type.Optional(
		Type.String({
			description: 'The adb serial of the Android device, when several are attached.',
		}),
	),
	ios: defaulted(
		Type.Boolean({
			description: 'Act on a jailbroken iPhone through jb-p1lot instead of over adb.',
		}),
		false,
	),
	udid: Type.Optional(
		Type.String({
			description: 'The UDID of the iPhone, when several are connected. Implies --ios.',
		}),
	),
	restart: defaulted(Type.Boolean({ description: 'Relaunch Discord afterwards.' }), false),
});

const deviceCommand: CommandDefinition<typeof schema> = {
	name: 'device',
	description:
		"Reset, snapshot or restore Discord's Unbound state on a rooted Android device or a jailbroken " +
		'iPhone. `reset` moves the Unbound folder aside so Discord starts fresh; `save <name>` keeps a copy ' +
		'on this computer; `restore <name>` puts one back, keeping the replaced folder on the device; ' +
		'`list` shows the saved snapshots. Nothing on the device is deleted.',
	surfaces: { cli: 'root', mcp: true },
	schema,
	cli: { positionals: ['action', 'name'] },
	async handler({ action, name, serial, ios, udid, restart }) {
		if (action === 'list') {
			return listSnapshots();
		}

		const target = await openDeviceTarget({ serial, ios, udid });

		if ('error' in target) {
			return { ok: false, text: target.error };
		}

		switch (action) {
			case 'reset':
				return resetDevice(target, { restart });
			case 'save':
				return saveSnapshot(name, target);
			case 'restore':
				return restoreSnapshot(name, target, { restart });
		}
	},
};

export default deviceCommand;
