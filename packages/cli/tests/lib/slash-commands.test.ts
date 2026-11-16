import type { UnboundGlobal } from '@unbound-app/api/global';
import { describe, expect, test } from 'bun:test';

import { createDevicePrelude } from '~/lib/device-prelude';
import { runSlashCommand } from '~/lib/slash-commands';

type RawOption = { type: number; name: string; value: string | number | boolean };

type Reply = { content: string };

type FakeDevice = {
	metro: { findByProps: (prop: never) => object };
	flux: { getStore: (name: never) => object | undefined };
};

function isDevice(value: FakeDevice): value is FakeDevice & UnboundGlobal {
	return 'metro' in value && 'flux' in value;
}

function deviceWith(reply?: Reply) {
	const calls: RawOption[][] = [];
	const commands = [
		{ untranslatedName: 'shrug' },
		{
			name: 'roll',
			options: [
				{ name: 'sides', type: 4, required: true },
				{ name: 'secret', type: 5 },
			],
			execute: async (raw: RawOption[]) => {
				calls.push(raw);

				return reply;
			},
		},
	];
	const modules = { getBuiltInCommands: { getBuiltInCommands: () => commands } };
	const stores = {
		Channel: { getChannel: (id: string) => (id === '42' ? { id, guild_id: null } : undefined) },
		SelectedChannel: { getChannelId: () => '42' },
		Guild: { getGuild: () => undefined },
	};
	const device = {
		metro: { findByProps: (prop: keyof typeof modules) => modules[prop] },
		flux: { getStore: (name: keyof typeof stores) => stores[name] },
	};

	if (!isDevice(device)) {
		throw new Error('The fake device has no metro or flux.');
	}

	return { prelude: createDevicePrelude(device), calls };
}

describe('runSlashCommand', () => {
	test('runs the command in the open channel with typed options and returns its reply', async () => {
		const { prelude, calls } = deviceWith({ content: 'You rolled 4' });

		expect(
			await runSlashCommand(prelude, '/roll', { sides: '6', secret: 'true' }, null),
		).toEqual({
			command: '/roll',
			channelId: '42',
			reply: { content: 'You rolled 4', embeds: undefined },
		});
		expect(calls).toEqual([
			[
				{ type: 4, name: 'sides', value: 6 },
				{ type: 5, name: 'secret', value: true },
			],
		]);
	});

	test('names the valid options and the required ones', async () => {
		const { prelude } = deviceWith();

		expect(runSlashCommand(prelude, 'roll', { faces: '6' }, null)).rejects.toThrow(
			'/roll has no option faces; its options: sides, secret.',
		);
		expect(runSlashCommand(prelude, 'roll', {}, null)).rejects.toThrow('/roll needs sides.');
	});

	test('lists the named commands when none matches, and rejects an unknown channel', async () => {
		const { prelude } = deviceWith();

		expect(runSlashCommand(prelude, 'nope', {}, null)).rejects.toThrow(
			'No slash command /nope. The device has: /roll.',
		);
		expect(runSlashCommand(prelude, 'roll', { sides: '6' }, '7')).rejects.toThrow(
			'No channel 7 on the device.',
		);
	});
});
