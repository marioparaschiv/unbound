import { metro } from '@unbound-app/api/testing';
import { settings } from '@unbound-app/settings';
import { describe, expect, test } from 'bun:test';

import { createApiKey, switchToListenBrainz } from '~/actions';
import { readPreferences } from '~/presence/preferences';

describe('the settings buttons', () => {
	test('Create an API Key opens the Last.fm page that makes one', () => {
		const opened: string[] = [];

		metro.register({ openURL: (url: string) => void opened.push(url), openSettings: () => {} });
		createApiKey();

		expect(opened).toEqual(['https://www.last.fm/api/account/create']);
	});

	test('Instance Incomplete switches back to ListenBrainz', () => {
		settings.scrobblerBackend = 'listenbrainz-compatible';
		switchToListenBrainz();

		expect(readPreferences(settings).scrobblerBackend).toBe('listenbrainz');
	});
});
