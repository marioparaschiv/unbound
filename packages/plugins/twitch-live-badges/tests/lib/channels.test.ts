import { describe, expect, test } from 'bun:test';

import { embedChannel, twitchChannels } from '~/lib/channels';

describe('twitchChannels', () => {
	test('finds each linked channel once, in lowercase', () => {
		expect(
			twitchChannels(
				'watch https://twitch.tv/KaiCenat and https://www.twitch.tv/kaicenat/ now',
			),
		).toEqual(['kaicenat']);
		expect(twitchChannels('<https://m.twitch.tv/shroud?x=1>')).toEqual(['shroud']);
	});

	test('skips Twitch pages that are not channels', () => {
		expect(twitchChannels('https://twitch.tv/directory https://twitch.tv/videos/123')).toEqual(
			[],
		);
		expect(embedChannel('https://clips.twitch.tv/abc')).toBeUndefined();
	});
});
