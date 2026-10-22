import { expect, mock, test } from 'bun:test';

let pickerResult: unknown;
let fileType = 'NSFileTypeRegular';
let fileSize = 4096;

const picker = {
	launchImageLibraryAsync: async () => pickerResult,
};
const fileManager = {};

mock.module('@unbound-app/api', () => ({
	fs: { Documents: '/Documents' },
	metro: { findByProps: () => picker },
}));

const { pickMedia, persistMedia, setMediaContext } = await import('@custom-commands/media');

setMediaContext({
	native: {
		objc: {
			getClass: (name: string) => name,
			call: (receiver: string, selector: string, ...args: unknown[]) => {
				if (selector === 'defaultManager') return fileManager;
				if (selector === 'attributesOfItemAtPath:error:')
					return { NSFileType: fileType, NSFileSize: fileSize };
				if (selector === 'typeWithFilenameExtension:') return args[0];
				if (selector === 'preferredMIMEType')
					return receiver === 'mov' ? 'video/quicktime' : 'image/png';
				if (selector === 'copyItemAtPath:toPath:error:') return true;
				return null;
			},
		},
	},
} as Parameters<typeof setMediaContext>[0]);

test('fills missing picker filename and size from a regular image file', async () => {
	fileType = 'NSFileTypeRegular';
	fileSize = 193309;
	pickerResult = {
		assets: [
			{ uri: 'file:///Documents/tmp/photo.png', type: 'image/png', width: 750, height: 1334 },
		],
	};

	const [media] = await pickMedia();
	expect(media.fileName).toBe('photo.png');
	expect(media.fileSize).toBe(193309);
	expect(media.type).toBe('image/png');
	expect((await persistMedia(media)).fileSize).toBe(193309);
});

test('resolves missing MIME type from the file extension', async () => {
	fileType = 'NSFileTypeRegular';
	fileSize = 8192;
	pickerResult = { assets: [{ uri: 'file:///Documents/tmp/clip.mov' }] };

	const [media] = await pickMedia();
	expect(media.fileName).toBe('clip.mov');
	expect(media.fileSize).toBe(8192);
	expect(media.type).toBe('video/quicktime');
});

test('rejects picker results that point at a directory', async () => {
	fileType = 'NSFileTypeDirectory';
	fileSize = 0;
	pickerResult = { assets: [{ uri: 'file:///Documents/tmp/' }] };

	expect(pickMedia()).rejects.toThrow('available');
});
