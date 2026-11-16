import { describe, expect, test } from 'bun:test';

import { convertedFile, libraryIdentifier } from '~/lib/files';

describe('Live Photo files', () => {
	test('reads library identifiers, also after another plugin copied the file', () => {
		const id = 'DA93D262-0491-4A7C-9918-5D927D67FD74/L0/001';

		expect(libraryIdentifier({ uri: `ph://${id}`, id })).toBe(id);
		expect(libraryIdentifier({ uri: 'file:///tmp/copy.jpg', id })).toBe(id);
		expect(libraryIdentifier({ uri: 'file:///tmp/a.jpg', id: 'upload-3' })).toBeUndefined();
	});

	test('describes the video and GIF that replace a photo', () => {
		const file = {
			id: 'ABC/L0/001',
			uri: 'ph://ABC/L0/001',
			filename: 'IMG_1.HEIC',
			width: 4032,
			height: 3024,
			origin: 1,
		};

		expect(convertedFile(file, 'video', '/tmp/a.mov')).toMatchObject({
			id: 'ABC/L0/001-video',
			uri: 'file:///tmp/a.mov',
			originalUri: 'file:///tmp/a.mov',
			filename: 'IMG_1.mov',
			mimeType: 'video/quicktime',
			width: 4032,
			origin: 1,
		});
		expect(convertedFile(file, 'gif', '/tmp/a.gif', { width: 480, height: 360 })).toMatchObject(
			{
				filename: 'IMG_1.gif',
				mimeType: 'image/gif',
				width: 480,
				height: 360,
			},
		);
	});
});
