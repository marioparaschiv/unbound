import { afterEach, expect, mock, test } from 'bun:test';

let pickerResult: unknown;
const writes: Array<{ content: string; encoding: string; path: string }> = [];

const picker = {
	launchImageLibraryAsync: async () => pickerResult,
};

mock.module('@unbound-app/api', () => ({
	fs: {
		Documents: '/Documents',
		read: async () => 'aW1hZ2UtYnl0ZXM=',
		write: async (path: string, content: string, encoding: string) => {
			writes.push({ path, content, encoding });
		},
	},
	metro: { findByProps: () => picker },
}));

const { pickMedia, persistMedia } = await import('@custom-commands/media');

afterEach(() => {
	writes.length = 0;
});

test('accepts local image metadata supplied by the platform picker', async () => {
	pickerResult = {
		assets: [
			{
				uri: 'file:///Documents/tmp/photo.png',
				mimeType: 'image/png',
				fileSize: 193309,
				width: 750,
				height: 1334,
			},
		],
	};

	const [media] = await pickMedia();
	expect(media.fileName).toBe('photo.png');
	expect(media.fileSize).toBe(193309);
	expect(media.type).toBe('image/png');

	const saved = await persistMedia(media);

	expect(saved.fileSize).toBe(193309);
	expect(saved.mimeType).toBe('image/png');
	expect(writes).toHaveLength(1);
	expect(writes[0]).toMatchObject({
		content: 'aW1hZ2UtYnl0ZXM=',
		encoding: 'base64',
	});
});

test('uses platform-neutral filename extensions when the picker omits MIME type', async () => {
	pickerResult = {
		assets: [{ uri: 'file:///Documents/tmp/clip.mov', fileSize: 8192 }],
	};

	const [media] = await pickMedia();
	expect(media.fileName).toBe('clip.mov');
	expect(media.fileSize).toBe(8192);
	expect(media.type).toBe('video/quicktime');
});

test('rejects picker results without usable local file metadata', async () => {
	pickerResult = { assets: [{ uri: 'file:///Documents/tmp/photo.png', mimeType: 'image/png' }] };

	await expect(pickMedia()).rejects.toThrow('file size');
});
