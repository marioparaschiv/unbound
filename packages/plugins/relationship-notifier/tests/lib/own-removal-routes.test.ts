import { describe, expect, test } from 'bun:test';

import { ownRemovalFromRequest } from '~/lib/own-removal-routes';

describe('ownRemovalFromRequest', () => {
	test('recognises removing a friend or a request', () => {
		expect(ownRemovalFromRequest('del', { url: '/users/@me/relationships/123' })).toEqual({
			kind: 'friends',
			id: '123',
		});
	});

	test('recognises leaving and deleting a server', () => {
		expect(ownRemovalFromRequest('del', '/users/@me/guilds/45?lurking=false')).toEqual({
			kind: 'guilds',
			id: '45',
		});
		expect(ownRemovalFromRequest('post', { url: '/guilds/46/delete' })).toEqual({
			kind: 'guilds',
			id: '46',
		});
		expect(ownRemovalFromRequest('del', { url: '/guilds/47' })).toEqual({
			kind: 'guilds',
			id: '47',
		});
	});

	test('recognises leaving a group chat, with an API prefix and query', () => {
		expect(
			ownRemovalFromRequest('del', {
				url: 'https://discord.com/api/v9/channels/78/',
				query: { silent: true },
			}),
		).toEqual({ kind: 'groups', id: '78' });
	});

	test('ignores other requests and methods', () => {
		expect(
			ownRemovalFromRequest('post', { url: '/users/@me/relationships/123' }),
		).toBeUndefined();
		expect(ownRemovalFromRequest('del', { url: '/channels/78/messages/9' })).toBeUndefined();
		expect(
			ownRemovalFromRequest('del', { url: '/users/@me/guilds/45/settings' }),
		).toBeUndefined();
		expect(ownRemovalFromRequest('del', null)).toBeUndefined();
		expect(ownRemovalFromRequest('del', { url: 5 })).toBeUndefined();
	});
});
