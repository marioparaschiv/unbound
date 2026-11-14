import { describe, expect, test } from 'bun:test';

import { clipType, pickClip } from '~/lib/clips';
import { playInEmbed, type RowEmbed } from '~/lib/embed-audio';

const collection = (
	tracks: { title: string; subtitle: string; preview?: string; search?: string }[],
) => ({
	title: 'Album',
	subtitle: 'Band',
	tracks,
});

describe('clips', () => {
	test('types Spotify clips as MP3 and iTunes clips as AAC', () => {
		expect(clipType('https://p.scdn.co/mp3-preview/1')).toBe('audio/mpeg');
		expect(clipType('https://audio-ssl.itunes.apple.com/a.m4a')).toBe('audio/mp4');
	});

	test('plays the first song with its own clip', async () => {
		const clip = await pickClip(
			collection([
				{ title: 'One', subtitle: 'Band', search: 'One Band' },
				{ title: 'Two', subtitle: 'Band', preview: 'https://p.scdn.co/2' },
			]),
			async () => 'https://itunes/1.m4a',
		);

		expect(clip).toEqual({
			url: 'https://p.scdn.co/2',
			title: 'Two',
			contentType: 'audio/mpeg',
		});
	});

	test('finds a clip on iTunes when no song has one', async () => {
		const clip = await pickClip(
			collection([{ title: 'One', subtitle: 'Band', search: 'One Band' }]),
			async (query) => (query === 'One Band' ? 'https://itunes/1.m4a' : undefined),
		);

		expect(clip).toEqual({
			url: 'https://itunes/1.m4a',
			title: 'One',
			contentType: 'audio/mp4',
		});
		expect(await pickClip(collection([]), async () => 'x')).toBeUndefined();
	});

	test('turns a link embed into an audio embed', () => {
		const embed: RowEmbed = { type: 'link', url: 'https://open.spotify.com/track/x' };

		playInEmbed(
			embed,
			{ url: 'https://p.scdn.co/1', title: 'One', contentType: 'audio/mpeg' },
			'Preview',
		);

		expect(embed).toEqual({
			type: 'audio',
			url: 'https://open.spotify.com/track/x',
			audio: {
				url: 'https://p.scdn.co/1',
				proxyURL: 'https://p.scdn.co/1',
				contentType: 'audio/mpeg',
				description: 'Preview',
			},
		});
	});
});
