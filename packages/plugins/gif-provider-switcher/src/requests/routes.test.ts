import { describe, expect, test } from 'bun:test';

import { matchGifRoute, resolveContext } from '~/requests/routes';

describe('matchGifRoute', () => {
	test('matches a GIF search with its query, limit, locale and format', () => {
		expect(
			matchGifRoute('get', {
				url: '/gifs/search',
				query: {
					q: 'cat',
					media_format: 'mp4',
					provider: 'klipy',
					locale: 'en-US',
					limit: 50,
				},
				oldFormErrors: true,
			}),
		).toEqual({
			route: { kind: 'search', query: 'cat', limit: 50 },
			context: { locale: 'en-US', mediaFormat: 'mp4' },
		});
	});

	test('accepts full API URLs and queries in the URL', () => {
		expect(
			matchGifRoute('get', 'https://discord.com/api/v9/gifs/search?q=dog&media_format=webm'),
		).toEqual({
			route: { kind: 'search', query: 'dog', limit: undefined },
			context: { mediaFormat: 'webm' },
		});
	});

	test('matches suggestions, trending and trending GIFs', () => {
		expect(matchGifRoute('get', { url: '/gifs/suggest', query: { q: 'ca' } })?.route).toEqual({
			kind: 'suggest',
			query: 'ca',
		});
		expect(matchGifRoute('get', { url: '/gifs/trending', query: {} })?.route).toEqual({
			kind: 'trending',
		});
		expect(
			matchGifRoute('get', { url: '/gifs/trending-gifs', query: { limit: '30' } })?.route,
		).toEqual({ kind: 'trending-gifs', limit: 30 });
	});

	test('matches integration search, as the /gif command uses', () => {
		expect(
			matchGifRoute('get', { url: '/integrations/tenor/search', query: { q: 'hi' } })?.route,
		).toEqual({ kind: 'integration', integration: 'tenor', query: 'hi', limit: undefined });
	});

	test('matches a GIF select only as a POST with an id', () => {
		expect(
			matchGifRoute('post', { url: '/gifs/select', body: { id: '7', q: 'cat' } })?.route,
		).toEqual({ kind: 'select', id: '7', query: 'cat' });
		expect(matchGifRoute('post', { url: '/gifs/select', body: {} })).toBeNull();
		expect(matchGifRoute('get', { url: '/gifs/select' })).toBeNull();
	});

	test('ignores empty queries and other endpoints', () => {
		expect(matchGifRoute('get', { url: '/gifs/search', query: { q: '  ' } })).toBeNull();
		expect(matchGifRoute('get', { url: '/gifs/trending-search' })).toBeNull();
		expect(matchGifRoute('get', { url: '/users/@me' })).toBeNull();
		expect(matchGifRoute('post', { url: '/gifs/search', query: { q: 'cat' } })).toBeNull();
		expect(matchGifRoute('get', undefined)).toBeNull();
		expect(matchGifRoute('get', { query: { q: 'cat' } })).toBeNull();
	});
});

describe('resolveContext', () => {
	test('prefers the request, then earlier requests, then defaults', () => {
		expect(resolveContext({ locale: 'de' }, { locale: 'fr', mediaFormat: 'webm' })).toEqual({
			locale: 'de',
			mediaFormat: 'webm',
		});
		expect(resolveContext({})).toEqual({ locale: 'en-US', mediaFormat: 'mp4' });
	});
});
