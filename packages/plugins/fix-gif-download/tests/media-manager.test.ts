import { metro, startPlugin } from '@unbound-app/api/testing';
import { beforeEach, describe, expect, test } from 'bun:test';

type Download = (source: unknown, mediaType: number, contentType?: string) => void;

const downloads: unknown[][] = [];

type Manager = {
	downloadMediaAsset: Download;
	downloadMediaAssetWithContentType: Download;
	isGIFSource: (source: unknown, contentType?: string) => boolean;
};

const newManager = (): Manager => ({
	downloadMediaAsset: (...args) => downloads.push(args),
	downloadMediaAssetWithContentType: (...args) => downloads.push(args),
	isGIFSource: () => false,
});

let manager = newManager();

beforeEach(async () => {
	downloads.length = 0;
	manager = newManager();
	metro.register(manager);
	metro.register({ GIF_RE_IOS: /gif/, MediaType: { GIF: 7 } });
	await startPlugin();
});

describe('saving media', () => {
	test('saves a Tenor GIF as a GIF file, not as its video', async () => {
		manager.downloadMediaAsset(
			{ sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.mp4' },
			2,
		);

		expect(downloads).toEqual([['https://media.tenor.com/abc123/AAAAC/example.gif', 7]]);
	});

	test('tells Discord the content type is a GIF when it asks for one', async () => {
		manager.downloadMediaAssetWithContentType(
			'https://media.tenor.com/abc123/AAAAC/example.mp4',
			2,
			'video/mp4',
		);

		expect(downloads).toEqual([
			['https://media.tenor.com/abc123/AAAAC/example.gif', 7, 'image/gif'],
		]);
	});

	test('saves other media as Discord would', async () => {
		manager.downloadMediaAsset('https://cdn.discordapp.com/attachments/1/2/photo.png', 0);

		expect(downloads).toEqual([['https://cdn.discordapp.com/attachments/1/2/photo.png', 0]]);
	});

	test('counts a GIF provider’s media as a GIF', async () => {
		expect(
			manager.isGIFSource({ sourceURI: 'https://media.tenor.com/abc123/AAAAC/example.mp4' }),
		).toBe(true);
		expect(manager.isGIFSource({ sourceURI: 'https://cdn.discordapp.com/photo.png' })).toBe(
			false,
		);
	});
});
