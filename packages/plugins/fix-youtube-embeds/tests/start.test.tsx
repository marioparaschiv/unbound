import { logs, metro, render, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';
import { Text } from 'react-native';

import { EMBED_ERROR_PATH, YOUTUBE_PATH } from '~/lib/constants';
import { selfTest } from '~/index';

const embedError = {
	default: (_props: { videoId: unknown }) => <Text>This video can’t be played here</Text>,
};

describe('starting the plugin', () => {
	test('reports both patches as applied', async () => {
		metro.register({ WebView: () => null });
		metro.register(embedError, EMBED_ERROR_PATH);
		metro.register({ default: () => null }, YOUTUBE_PATH);
		await startPlugin();

		expect((await selfTest()).ok).toBe(true);
	});

	test('fails to start when the viewer has an unexpected shape', async () => {
		metro.register({ WebView: () => null });
		metro.register(embedError, EMBED_ERROR_PATH);
		metro.register({ other: 1 }, YOUTUBE_PATH);

		await expect(startPlugin()).rejects.toThrow('Failed to patch component default');
		expect(render(<embedError.default videoId='dQw4w9WgXcQ' />).text()).toBe(
			'This video can’t be played here',
		);
	});

	test('keeps the error patch with one warning when Discord moved the viewer', async () => {
		metro.register({ WebView: () => null });
		metro.register(embedError, EMBED_ERROR_PATH);
		metro.markMissing(YOUTUBE_PATH);
		await startPlugin();

		expect(render(<embedError.default videoId='dQw4w9WgXcQ' />).findAll('Text')).toEqual([]);
		expect(logs.entries).toContainEqual({
			level: 'warn',
			args: ['Viewer controls skipped: Discord moved MediaModalYoutube.'],
		});
	});
});
