import { flux, metro, patches, startPlugin, stopPlugin } from '@unbound-app/api/testing';
import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

beforeEach(() => {
	resetHealth();
	flux.seed({
		User: { getUser: () => undefined },
		Message: { getMessage: () => undefined, getMessages: () => undefined },
		SelectedChannel: { getChannelId: () => 'c1' },
		Channel: { getChannel: () => undefined },
		GuildMember: { getMember: () => undefined },
	});
});

describe('starting', () => {
	test('indexes mentions as Discord builds each row, and leaves when stopped', async () => {
		metro.register({ generateMessageRowData: (_input: unknown) => ({}) });
		await startPlugin();

		expect(patches.applied).toMatchObject([{ method: 'generateMessageRowData' }]);

		await stopPlugin();
		expect(patches.applied).toEqual([]);
	});

	test('reports its features applied, though no mention is on screen yet', async () => {
		metro.register({ generateMessageRowData: (_input: unknown) => ({}) });
		metro.register({ getRole: () => undefined, getSortedRoles: () => [] });
		await startPlugin();

		expect(await selfTest()).toMatchObject({
			ok: false,
			detail: 'no mention avatars are drawn on screen',
		});
		await stopPlugin();
	});

	test('does nothing while Discord has no row generator', async () => {
		await startPlugin();

		expect(patches.applied).toEqual([]);
		await stopPlugin();
	});
});
