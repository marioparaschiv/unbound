import { describe, expect, test } from 'bun:test';

import { latestLoaderTag } from '../src/latest-loader-ipa';

const release = (tagName: string, isPrerelease = false, isDraft = false) => ({
	tagName,
	isDraft,
	isPrerelease,
});

describe('latestLoaderTag', () => {
	test('picks the newest stable iOS release, whose IPA keeps every image', () => {
		expect(
			latestLoaderTag([
				release('discord-356.0_123252-ios-testflight', true),
				release('loader-v1.7.1'),
				release('discord-354.0-ios', false, true),
				release('discord-353.0-ios'),
				release('discord-352.1-ios'),
			]),
		).toBe('discord-353.0-ios');
	});

	test('finds nothing without a stable iOS release', () => {
		expect(latestLoaderTag([release('loader-v1.7.1'), release('discord-353.0-android')])).toBe(
			undefined,
		);
	});
});
