import { resetHealth } from '@unbound-plugins/shared/lifecycle/health';
import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

// Health is module state that earlier tests in this process left behind.
beforeEach(() => {
	resetHealth();
});

describe('self test', () => {
	test('passes once the plugin has started', async () => {
		metro.register({
			downloadMediaAsset: () => undefined,
			downloadMediaAssetWithContentType: () => undefined,
			isGIFSource: () => false,
		});
		metro.register({ useMediaShareActions: () => undefined });
		await startPlugin();

		expect(selfTest()).toMatchObject({ ok: true });
	});
});
