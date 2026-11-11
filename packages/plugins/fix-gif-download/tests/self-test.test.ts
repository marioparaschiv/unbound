import { logs, metro, startPlugin } from '@unbound-app/api/testing';
import { describe, expect, test } from 'bun:test';

describe('self test', () => {
	test('passes once the plugin has started, with no warning', async () => {
		metro.register({
			downloadMediaAsset: () => undefined,
			downloadMediaAssetWithContentType: () => undefined,
			isGIFSource: () => false,
		});
		metro.register({ useMediaShareActions: () => undefined });
		await startPlugin();

		expect(logs.entries.filter(({ level }) => level === 'warn' || level === 'error')).toEqual(
			[],
		);
	});
});
