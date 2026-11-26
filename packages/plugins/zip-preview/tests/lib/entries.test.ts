import { describe, expect, test } from 'bun:test';

import { entryIcon, sharedRoot } from '~/lib/entries';

describe('sharedRoot', () => {
	test('finds the folder every file sits in', () => {
		expect(
			sharedRoot([
				{ name: 'project/readme.md', size: 1 },
				{ name: 'project/src/index.ts', size: 2 },
			]),
		).toBe('project/');
	});

	test('keeps paths whole when the files do not share a folder', () => {
		expect(
			sharedRoot([
				{ name: 'project/readme.md', size: 1 },
				{ name: 'other/index.ts', size: 2 },
			]),
		).toBe('');
		expect(sharedRoot([{ name: 'readme.md', size: 1 }])).toBe('');
		expect(sharedRoot([])).toBe('');
	});
});

describe('entryIcon', () => {
	test('names an icon by the file kind', () => {
		expect(entryIcon('art/cover.PNG')).toBe('ImageIcon');
		expect(entryIcon('clip.mp4')).toBe('VideoIcon');
		expect(entryIcon('song.flac')).toBe('MusicIcon');
		expect(entryIcon('readme.md')).toBe('FileIcon');
	});
});
