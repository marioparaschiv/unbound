import { beforeEach, expect, mock, test } from 'bun:test';

mock.module('~/account/discord-oauth', () => ({ authorizeWithDiscord: async () => undefined }));

const { getBucket, snapshot } = await import('~/storage/api');
const { getAccount } = await import('./api');
const { moveSyncSession } = await import('./legacy-session');

const settings = snapshot();

const SESSION = {
	token: 'token-sync',
	user: { id: 'user-alice', name: 'Alice', image: null, role: 'user' },
};

beforeEach(() => {
	for (const name of Object.keys(settings)) {
		delete settings[name];
	}
});

test('moves a session Sync saved to the account, keeping Sync settings', () => {
	getBucket('unbound::sync').set('session', SESSION);
	getBucket('unbound::sync').set('enabled', true);

	moveSyncSession();

	expect(getAccount()).toEqual({ id: 'user-alice', name: 'Alice', image: null });
	expect(settings['unbound::sync']).toEqual({ enabled: true });
});

test('changes nothing on a second run', () => {
	getBucket('unbound::sync').set('session', SESSION);

	moveSyncSession();
	moveSyncSession();

	expect(settings['unbound::account']).toEqual({ session: SESSION });
	expect(settings['unbound::sync']).toBeUndefined();
});

test('keeps a session the account already holds', () => {
	const current = { ...SESSION, token: 'token-account' };

	getBucket('unbound::account').set('session', current);
	getBucket('unbound::sync').set('session', SESSION);

	moveSyncSession();

	expect(settings['unbound::account']).toEqual({ session: current });
	expect(settings['unbound::sync']).toBeUndefined();
});
