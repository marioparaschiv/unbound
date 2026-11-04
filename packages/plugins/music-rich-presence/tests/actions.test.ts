import { metro } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

import { createApiKey } from '~/actions';

describe('the settings buttons', () => {
	test('Create an API Key opens the Last.fm page that makes one', () => {
		const opened: string[] = [];

		metro.register({ openURL: (url: string) => void opened.push(url), openSettings: () => {} });
		createApiKey();

		expect(opened).toEqual(['https://www.last.fm/api/account/create']);
	});
});
