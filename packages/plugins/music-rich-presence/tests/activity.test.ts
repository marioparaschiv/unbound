import { describe, expect, test } from 'bun:test';

import {
	buildActivity,
	fillStatusName,
	formatStatusName,
	pickLargeImage,
	resolveActivity,
	shouldHide,
} from '~/presence/activity';
import { DISCORD_APP_ID, LASTFM_PLACEHOLDER_IMAGE_HASH } from '~/constants';
import { SETTINGS } from './defaults';
import type { Scrobbler, TrackData } from '~/types';

const track: TrackData = {
	name: 'Song',
	album: 'Album',
	artist: 'Artist',
	trackURL: 'https://t',
	artistURL: 'https://a',
	albumURL: 'https://al',
	imageURL: 'https://img/cover.png',
	serviceName: 'Tidal',
};

const preferences = { ...SETTINGS, username: 'rini' };

const scrobbler: Scrobbler = {
	name: 'Last.fm',
	id: 'lastfm',
	fetchTrackData: async () => track,
	userUrl: (_preferences, username) => `https://www.last.fm/user/${username}`,
};

const resolve = async (key: string) => `asset:${key}`;

describe('status name', () => {
	test('fills every variable', () => {
		expect(fillStatusName('{artist} / {title} on {album} {artist}', track)).toBe(
			'Artist / Song on Album Artist',
		);
		expect(fillStatusName('{album}', { ...track, album: '' })).toBe('');
	});

	test('follows the name format', () => {
		const name = (nameFormat: typeof SETTINGS.nameFormat, overrides: Partial<TrackData> = {}) =>
			formatStatusName(
				{ ...preferences, nameFormat, statusName: '{title}!' },
				{ ...track, ...overrides },
			);

		expect(name('status-name')).toBe('Song!');
		expect(name('artist-first')).toBe('Artist - Song');
		expect(name('song-first')).toBe('Song - Artist');
		expect(name('artist')).toBe('Artist');
		expect(name('song')).toBe('Song');
		expect(name('album')).toBe('Album');
		expect(name('album', { album: '' })).toBe('Song!');
		expect(name('service-name')).toBe('Tidal');
		expect(name('service-name', { serviceName: undefined })).toBe('Song!');
	});
});

describe('pickLargeImage', () => {
	test('uses the cover unless it is hidden or the Last.fm placeholder', () => {
		expect(pickLargeImage(preferences, track)).toBe('https://img/cover.png');
		expect(pickLargeImage({ ...preferences, showAlbumCover: false }, track)).toBeUndefined();
		expect(
			pickLargeImage(preferences, {
				...track,
				imageURL: `https://lastfm/${LASTFM_PLACEHOLDER_IMAGE_HASH}.png`,
			}),
		).toBeUndefined();
		expect(
			pickLargeImage(
				{ ...preferences, missingArt: 'placeholder' },
				{ ...track, imageURL: undefined },
			),
		).toBe('placeholder');
	});
});

describe('shouldHide', () => {
	const spotify = { application_id: undefined, type: 2 };
	const game = { application_id: '1', type: 0 };
	const customStatus = { type: 4 };
	const own = { application_id: DISCORD_APP_ID, type: 2 };

	test('hides for other music by default', () => {
		expect(shouldHide(preferences, [spotify])).toBe(true);
		expect(shouldHide(preferences, [own, customStatus, game])).toBe(false);
		expect(shouldHide({ ...preferences, hideWithSpotify: false }, [spotify])).toBe(false);
	});

	test('hides for any activity but a custom status when asked', () => {
		const strict = { ...preferences, hideWithSpotify: false, hideWithActivity: true };

		expect(shouldHide(strict, [game])).toBe(true);
		expect(shouldHide(strict, [customStatus, own])).toBe(false);
	});
});

describe('buildActivity', () => {
	test('builds the default activity', async () => {
		expect(await buildActivity(preferences, track, scrobbler, resolve)).toEqual({
			application_id: DISCORD_APP_ID,
			name: 'some music',
			details: 'Song',
			state: 'Artist',
			status_display_type: 1,
			assets: {
				large_image: 'asset:https://img/cover.png',
				large_text: 'Album',
				large_url: 'https://al',
				small_image: 'asset:lastfm-small',
				small_text: 'lastfm',
			},
			buttons: undefined,
			metadata: { button_urls: [] },
			type: 0,
			flags: 1,
			details_url: 'https://t',
			state_url: 'https://a',
		});
	});

	test('uses the large logo without art and honours every switch', async () => {
		const activity = await buildActivity(
			{
				...preferences,
				showAlbumCover: false,
				clickableLinks: false,
				shareUsername: true,
				useListeningStatus: true,
				statusDisplayType: 'track',
			},
			{ ...track, album: '' },
			scrobbler,
			resolve,
		);

		expect(activity.assets).toEqual({
			large_image: 'asset:lastfm-large',
			large_text: undefined,
		});
		expect(activity.buttons).toEqual(['Last.fm Profile']);
		expect(activity.metadata?.button_urls).toEqual(['https://www.last.fm/user/rini']);
		expect(activity.type).toBe(2);
		expect(activity.status_display_type).toBe(2);
		expect(activity.details_url).toBeUndefined();
	});

	test('leaves out the logo and the album link when asked or without an album', async () => {
		const activity = await buildActivity(
			{
				...preferences,
				showLogo: false,
				missingArt: 'placeholder',
				statusDisplayType: 'off',
			},
			{ ...track, album: '', imageURL: undefined },
			scrobbler,
			resolve,
		);

		expect(activity.assets).toEqual({
			large_image: 'asset:placeholder',
			large_text: undefined,
		});
		expect(activity.status_display_type).toBe(0);
	});
});

describe('resolveActivity', () => {
	test('skips the lookup while hidden', async () => {
		let fetched = false;
		const counting: Scrobbler = {
			...scrobbler,
			fetchTrackData: async () => {
				fetched = true;
				return track;
			},
		};

		expect(
			await resolveActivity(preferences, [{ type: 2 }], counting, fetch as never, resolve),
		).toBeNull();
		expect(fetched).toBe(false);
	});

	test('clears when nothing is playing', async () => {
		const idle: Scrobbler = { ...scrobbler, fetchTrackData: async () => null };

		expect(await resolveActivity(preferences, [], idle, fetch as never, resolve)).toBeNull();
	});

	test('builds the activity for a playing track', async () => {
		expect(
			(await resolveActivity(preferences, [], scrobbler, fetch as never, resolve))?.details,
		).toBe('Song');
	});
});
