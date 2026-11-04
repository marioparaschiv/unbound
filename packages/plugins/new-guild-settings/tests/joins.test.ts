import { storage } from '@unbound-app/api';
import { beforeEach, describe, expect, test } from 'bun:test';

import { PLUGIN_ID } from '~/constants';

import { ME, applied, dispatch, guildActions, startGuildSettings, toggled } from './discord';

describe('joining a server', () => {
	beforeEach(() => startGuildSettings());

	test('applies the defaults after an accepted invite', async () => {
		await dispatch({ type: 'INVITE_ACCEPT_SUCCESS', invite: { guild: { id: '100' } } });

		expect(applied).toEqual([
			{
				guildId: '100',
				update: {
					muted: true,
					suppress_everyone: true,
					suppress_roles: true,
					mute_scheduled_events: true,
					notify_highlights: 1,
				},
			},
		]);
	});

	test('ignores an invite to a server the user was already in', async () => {
		await dispatch({
			type: 'INVITE_ACCEPT_SUCCESS',
			invite: { guild_id: '100', new_member: false },
		});

		expect(applied).toEqual([]);
	});

	test('applies once a join request for the user is approved, and not for someone else', async () => {
		await dispatch({
			type: 'GUILD_JOIN_REQUEST_UPDATE',
			status: 'APPROVED',
			guildId: '200',
			request: { user_id: '9' },
		});
		expect(applied).toEqual([]);

		await dispatch({
			type: 'GUILD_JOIN_REQUEST_UPDATE',
			status: 'APPROVED',
			guildId: '200',
			request: { user_id: ME },
		});
		expect(applied.map(({ guildId }) => guildId)).toEqual(['200']);
	});

	test('changes a server once when several paths report the same join', async () => {
		await dispatch({ type: 'INVITE_ACCEPT_SUCCESS', invite: { guild: { id: '100' } } });
		await dispatch({ type: 'INVITE_ACCEPT_SUCCESS', invite: { guild: { id: '100' } } });

		expect(applied).toHaveLength(1);
	});

	test('applies after a direct join resolves, but not after a lurking join', async () => {
		await guildActions.joinGuild('300', { lurker: true });
		await guildActions.joinGuild('400');

		expect(applied.map(({ guildId }) => guildId)).toEqual(['400']);
	});

	test('follows the saved settings', async () => {
		storage.getBucket(PLUGIN_ID).set('guild', false);
		await dispatch({ type: 'INVITE_ACCEPT_SUCCESS', invite: { guild: { id: '100' } } });

		expect(applied[0]?.update).toMatchObject({ muted: false });
	});
});

describe('a server that hides channels', () => {
	beforeEach(() => startGuildSettings(true));

	test('shows all its channels once joined', async () => {
		await dispatch({ type: 'INVITE_ACCEPT_SUCCESS', invite: { guild: { id: '100' } } });

		expect(toggled).toEqual(['100']);
	});
});
