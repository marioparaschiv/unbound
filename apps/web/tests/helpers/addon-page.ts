import {
	addonPageSchema,
	type AddonPage,
	type MeasuredMedia,
} from '@unbound-app/contracts/addon-page';

import type { MarkdownPin } from '~/lib/markdown-url';

import type { FixtureFiles } from './github';

export const PAGE_SHA = '3f9c2e1aa0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5';
export const PAGE_PIN: MarkdownPin = {
	repository: 'acme/addons',
	commitSha: PAGE_SHA,
	path: 'plugins/hello',
};

const THUMBHASH = 'IhUKMphwd3eIiHiIgHcIh4g=';

function measure(path: string, width: number, height: number, bytes: number = 1024): MeasuredMedia {
	const video = path.endsWith('.mp4');

	return {
		path,
		kind: video ? 'video' : 'image',
		width,
		height,
		...(video ? { duration: 12 } : {}),
		thumbhash: THUMBHASH,
		bytes,
	};
}

export const PAGE_SOURCE = [
	'---',
	'banner: media/banner.png',
	'media:',
	'  - image: media/shot.png',
	'    alt: The settings screen',
	'  - video: media/tour.mp4',
	'    poster: media/tour.png',
	'    alt: A tour of the plugin',
	'---',
	'## Usage',
	'',
	'![Inline screenshot](media/inline.png)',
	'',
	'![Inline clip](media/clip.mp4)',
	'',
	'| Option | Default |',
	'| --- | --- |',
	'| `color` | `red` |',
	'',
	'![Not measured](media/missing.png) and ![tracker](https://evil.example/pixel.png)',
	'',
].join('\n');

export const PAGE = addonPageSchema.parse({
	frontmatter: {
		banner: 'media/banner.png',
		media: [
			{ image: 'media/shot.png', alt: 'The settings screen' },
			{ video: 'media/tour.mp4', poster: 'media/tour.png', alt: 'A tour of the plugin' },
		],
	},
	media: [
		measure('media/banner.png', 1500, 500),
		measure('media/shot.png', 1280, 720),
		measure('media/tour.mp4', 1080, 1920),
		measure('media/tour.png', 1080, 1920),
		measure('media/inline.png', 800, 600),
		measure('media/clip.mp4', 1280, 720),
	],
});

export const COMMITTED_ADDON_MD = [
	'---',
	'banner: media/banner.png',
	'media:',
	'  - image: media/shot.png',
	'    alt: The settings screen',
	'---',
	'## Usage',
	'',
	'![Inline screenshot](media/inline.png)',
	'',
].join('\n');

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * @description Makes the bytes of a PNG file of a given size: the PNG signature, then zeros.
 * @param bytes The file's size.
 * @returns The file's bytes.
 */
export function png(bytes: number): Uint8Array {
	const data = new Uint8Array(bytes);

	data.set(PNG_SIGNATURE);

	return data;
}

/**
 * @description Builds the page `ubd build` measures from {@link COMMITTED_ADDON_MD}.
 * @param bytes The size of each media file.
 * @returns The measured page.
 */
export function committedPage(bytes: number): AddonPage {
	return addonPageSchema.parse({
		frontmatter: {
			banner: 'media/banner.png',
			media: [{ image: 'media/shot.png', alt: 'The settings screen' }],
		},
		media: [
			measure('media/banner.png', 1500, 500, bytes),
			measure('media/shot.png', 1280, 720, bytes),
			measure('media/inline.png', 800, 600, bytes),
		],
	});
}

/**
 * @description Lists the files of a built plugin whose ADDON.md shows many inline images.
 * @param count How many inline images ADDON.md shows besides its banner.
 * @returns The files, relative to the plugin's directory.
 */
export function manyMediaFiles(count: number): FixtureFiles {
	const inline = Array.from({ length: count }, (_, index) => `media/inline-${index}.png`);
	const files: FixtureFiles = {
		'ADDON.md': [
			'---',
			'banner: media/banner.png',
			'---',
			...inline.map((path) => `![Inline](${path})`),
		].join('\n\n'),
		'dist/page.json': JSON.stringify(
			addonPageSchema.parse({
				frontmatter: { banner: 'media/banner.png' },
				media: [
					measure('media/banner.png', 1500, 500, 64),
					...inline.map((path) => measure(path, 800, 600, 64)),
				],
			}),
		),
		'media/banner.png': png(64),
	};

	for (const path of inline) {
		files[path] = png(64);
	}

	return files;
}

/**
 * @description Lists the files of a built plugin with a store page: ADDON.md, `dist/page.json` and the media.
 * @param bytes The size of each media file.
 * @returns The files, relative to the plugin's directory.
 */
export function committedPageFiles(bytes: number = 64): FixtureFiles {
	return {
		'ADDON.md': COMMITTED_ADDON_MD,
		'dist/page.json': JSON.stringify(committedPage(bytes)),
		'media/banner.png': png(bytes),
		'media/shot.png': png(bytes),
		'media/inline.png': png(bytes),
	};
}
