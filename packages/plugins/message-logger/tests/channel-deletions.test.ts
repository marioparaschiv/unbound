import { settings } from '@unbound-app/settings';
import { beforeEach, describe, expect, test } from 'bun:test';

import { clearDeletedChannels, deletedChannels } from '~/lib/deleted-channels';

import { dispatch, startLogger } from './helpers/discord';

beforeEach(async () => {
	await startLogger();
	clearDeletedChannels();
	settings.logDeletedChannels = true;
});

const deleteChannel = (channel: Record<string, unknown>) =>
	dispatch({ type: 'CHANNEL_DELETE', channel });

describe('a deleted channel', () => {
	test('is logged with its server, category and topic', async () => {
		await deleteChannel({
			id: 'c9',
			name: 'general',
			type: 0,
			guild_id: 'g1',
			parent_id: 'cat1',
			topic: 'Say hi',
		});

		expect(deletedChannels()).toMatchObject([
			{
				id: 'c9',
				name: 'general',
				guildName: 'Unbound',
				categoryName: 'Text Channels',
				topic: 'Say hi',
			},
		]);
	});

	test('logs a deleted thread with its parent channel', async () => {
		await dispatch({
			type: 'THREAD_DELETE',
			channel: {
				id: 't1',
				name: 'release notes',
				type: 11,
				guild_id: 'g1',
				parent_id: 'cat1',
			},
		});

		expect(deletedChannels()).toMatchObject([
			{ id: 't1', name: 'release notes', type: 11, categoryName: 'Text Channels' },
		]);
	});

	test('is not logged when it is a closed DM', async () => {
		await deleteChannel({ id: 'dm1', type: 1 });

		expect(deletedChannels()).toEqual([]);
	});

	test('is not logged while the setting is off', async () => {
		settings.logDeletedChannels = false;
		await deleteChannel({ id: 'c9', name: 'general', guild_id: 'g1' });

		expect(deletedChannels()).toEqual([]);
	});
});
