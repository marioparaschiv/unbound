import { describe, expect, test } from 'bun:test';

import { buildActivity, type PresenceOptions } from '~/lib/activity';

const options: PresenceOptions = {
	appId: '123',
	appName: 'Unbound',
	type: 'playing',
	streamLink: '',
	details: 'Porting plugins',
	state: '',
	timestamps: 'now',
	largeImage: 'https://example.com/a.png',
	largeText: 'Big',
	smallImage: '',
	smallText: '',
	buttonOneText: 'Site',
	buttonOneUrl: 'https://unbound.rip',
	buttonTwoText: 'Half',
	buttonTwoUrl: '',
};
const now = new Date(2026, 10, 13, 15, 30);
const resolve = async (image: string) => `mp:${image}`;

describe('custom activity', () => {
	test('builds the activity the settings describe', async () => {
		expect(await buildActivity(options, now, resolve)).toEqual({
			application_id: '123',
			name: 'Unbound',
			type: 0,
			flags: 1,
			details: 'Porting plugins',
			timestamps: { start: now.getTime() },
			assets: { large_image: 'mp:https://example.com/a.png', large_text: 'Big' },
			buttons: ['Site'],
			metadata: { button_urls: ['https://unbound.rip'] },
		});
	});

	test('shows nothing without a name', async () => {
		expect(await buildActivity({ ...options, appName: ' ' }, now, resolve)).toBeUndefined();
	});

	test('streams with its link and times from midnight', async () => {
		const activity = await buildActivity(
			{
				...options,
				type: 'streaming',
				streamLink: 'https://twitch.tv/x',
				timestamps: 'time',
			},
			now,
			resolve,
		);

		expect(activity?.type).toBe(1);
		expect(activity?.url).toBe('https://twitch.tv/x');
		expect(activity?.timestamps?.start).toBe(new Date(2026, 10, 13).getTime());
	});
});
