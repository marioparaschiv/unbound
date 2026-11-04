import { metro, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

import { selfTest } from '~/index';

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
