import { describe, expect, test } from 'bun:test';

import { decorateEmbeds } from '~/lib/decorate';
import type { StreamStatus } from '~/lib/status';

const label = (status: StreamStatus) => (status.live ? `Live ${status.uptime}` : 'Offline');

describe('decorateEmbeds', () => {
	test('writes the status after Twitch, replacing an older one', () => {
		const embeds = [
			{ url: 'https://www.twitch.tv/kaicenat', provider: { name: 'Twitch · Offline' } },
			{ url: 'https://example.com', provider: { name: 'Example' } },
		];

		expect(decorateEmbeds(embeds, () => ({ live: true, uptime: '2h 5m' }), label)).toEqual([
			{ url: 'https://www.twitch.tv/kaicenat', provider: { name: 'Twitch · Live 2h 5m' } },
			{ url: 'https://example.com', provider: { name: 'Example' } },
		]);
	});

	test('leaves embeds alone while the status is unknown', () => {
		const embeds = [{ url: 'https://twitch.tv/a_b_c', provider: { name: 'Twitch' } }];

		expect(decorateEmbeds(embeds, () => undefined, label)).toEqual(embeds);
	});
});
