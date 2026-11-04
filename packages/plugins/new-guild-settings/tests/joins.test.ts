import { flux, metro } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { startJoins } from '~/joins';

type Update = Record<string, unknown>;

const ME = '1';
const guildActions = {
	joinGuild: async (..._args: unknown[]) => undefined,
	waitForGuild: async () => undefined,
};
// UNKNOWN: a test sends Discord's action payloads, which FluxAction does not type.
function dispatch(action: { type: string } & Record<string, unknown>) {
	return flux.dispatch(action);
}

const applied: { guildId: string; update: Update }[] = [];

beforeEach(() => {
	applied.length = 0;

	metro.register({
		updateGuildNotificationSettings: (guildId: string, update: Update) =>
			void applied.push({ guildId, update }),
	});
	metro.register({ toggleShowAllChannels: () => undefined });
	metro.register(guildActions);
	flux.seed({
		User: { getCurrentUser: () => ({ id: ME }) },
		UserGuildSettings: { isOptInEnabled: () => false },
	});
	startJoins();
});

describe('joining a server', () => {
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
});
