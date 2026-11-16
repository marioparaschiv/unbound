import { describe, expect, test } from 'bun:test';

import { mp3Of, recordingTitles } from '~/lib/pronunciation';

describe('recordingTitles', () => {
	test('keeps recordings, the reader language first', () => {
		expect(
			recordingTitles(
				{
					items: [
						{ title: 'File:De-Haus.ogg' },
						{ title: 'File:Picture.jpg' },
						{ title: 'File:en-us-house.ogg' },
					],
				},
				'en',
			),
		).toEqual(['File:en-us-house.ogg', 'File:De-Haus.ogg']);
	});
});

describe('mp3Of', () => {
	test('reads the MP3 version', () => {
		expect(
			mp3Of({
				query: {
					pages: {
						'1': {
							videoinfo: [
								{
									derivatives: [
										{ type: 'audio/ogg', src: 'a.ogg' },
										{ type: 'audio/mpeg', src: 'a.mp3' },
									],
								},
							],
						},
					},
				},
			}),
		).toBe('a.mp3');
		expect(mp3Of(undefined)).toBeUndefined();
	});
});
