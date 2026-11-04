import { startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { register } from './fake-discord';

type Source = Record<string, unknown>;

const options: { source: Source }[] = [];

// The fake metro keeps its modules between tests, so register Discord's module once.
const shareActions = register({
	useMediaShareActions: (given: { source: Source }) => options.push(given),
}) as { useMediaShareActions: (given: { source: Source }) => void };

beforeEach(async () => {
	options.length = 0;
	await startPlugin();
});

describe('share and save actions', () => {
	test('point at the GIF instead of the video Discord plays', async () => {
		const { useMediaShareActions } = shareActions;

		useMediaShareActions({
			source: {
				uri: 'https://media.tenor.com/abc123/AAAAC/example.mp4',
				sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.mp4',
				videoURI: 'https://media.tenor.com/abc123/AAAAC/example.mp4',
				isGIFV: true,
			},
		});

		expect(options[0]?.source).toEqual({
			uri: 'https://media.tenor.com/abc123/AAAAC/example.gif',
			sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.gif',
			contentType: 'image/gif',
		});
	});

	test('leave a plain photo alone', async () => {
		const { useMediaShareActions } = shareActions;
		const source = { uri: 'https://cdn.discordapp.com/attachments/1/2/photo.png' };

		useMediaShareActions({ source });

		expect(options[0]?.source).toEqual({
			uri: 'https://cdn.discordapp.com/attachments/1/2/photo.png',
		});
	});

	test('reach a copy of the module Discord loads later', async () => {
		const { useMediaShareActions } = register({
			useMediaShareActions: (given: { source: Source }) => options.push(given),
		});

		(useMediaShareActions as (given: { source: Source }) => void)({
			source: { uri: 'https://media.tenor.com/abc123/AAAAC/example.mp4' },
		});

		expect(options[0]?.source.uri).toBe('https://media.tenor.com/abc123/AAAAC/example.gif');
	});
});
