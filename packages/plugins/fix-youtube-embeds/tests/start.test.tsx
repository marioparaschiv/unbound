import { metro, render, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { Text } from 'react-native';

import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';

import { EMBED_ERROR_PATH, YOUTUBE_PATH } from '~/constants';
import { selfTest } from '~/index';

const embedError = {
	default: (_props: { videoId: unknown }) => <Text>This video can’t be played here</Text>,
};

describe('starting the plugin', () => {
	beforeEach(resetHealth);

	test('reports both patches as applied', async () => {
		metro.register({ WebView: () => null });
		metro.register(embedError, EMBED_ERROR_PATH);
		metro.register({ default: () => null }, YOUTUBE_PATH);
		await startPlugin();

		expect((await selfTest()).ok).toBe(true);
	});

	test('keeps the error patch when the viewer has an unexpected shape', async () => {
		const error = spyOn(console, 'error').mockImplementation(() => void 0);

		metro.register({ WebView: () => null });
		metro.register(embedError, EMBED_ERROR_PATH);
		metro.register({ other: 1 }, YOUTUBE_PATH);
		await startPlugin();

		expect(render(<embedError.default videoId='dQw4w9WgXcQ' />).findAll('Text')).toEqual([]);
		expect(await selfTest()).toMatchObject({
			ok: false,
			detail: expect.stringContaining('start failed'),
		});

		error.mockRestore();
	});
});
