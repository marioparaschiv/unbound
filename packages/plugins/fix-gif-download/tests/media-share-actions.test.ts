import { metro as pluginMetro } from '@unbound-app/api';
import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, spyOn, test } from 'bun:test';

type Source = Record<string, unknown>;

const options: { source: Source }[] = [];

type ShareActions = { useMediaShareActions: (given: { source: Source }) => void };

const newShareActions = (): ShareActions => ({
	useMediaShareActions: (given) => options.push(given),
});

let shareActions = newShareActions();

beforeEach(async () => {
	options.length = 0;
	shareActions = newShareActions();
	metro.register(shareActions);
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
		const later = newShareActions();

		metro.register(later);
		later.useMediaShareActions({
			source: { uri: 'https://media.tenor.com/abc123/AAAAC/example.mp4' },
		});

		expect(options[0]?.source.uri).toBe('https://media.tenor.com/abc123/AAAAC/example.gif');
	});

	test('patch a copy Discord exports as its default', async () => {
		const wrapped = { default: newShareActions() };

		metro.register(wrapped);
		wrapped.default.useMediaShareActions({
			source: { uri: 'https://media.tenor.com/abc123/AAAAC/example.mp4' },
		});

		expect(options[0]?.source.uri).toBe('https://media.tenor.com/abc123/AAAAC/example.gif');
	});

	test('look for loaded copies without loading any module', async () => {
		const find = spyOn(pluginMetro, 'find');

		await startPlugin();

		expect(find).toHaveBeenCalledWith(expect.any(Function), { all: true, initialize: false });
	});
});
