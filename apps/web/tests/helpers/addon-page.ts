import { addonPageSchema, type MeasuredMedia } from '@unbound-app/contracts/addon-page';

import type { MarkdownPin } from '~/lib/markdown-url';

export const PAGE_SHA = '3f9c2e1aa0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5';
export const PAGE_PIN: MarkdownPin = {
	repository: 'acme/addons',
	commitSha: PAGE_SHA,
	path: 'plugins/hello',
};

const THUMBHASH = 'IhUKMphwd3eIiHiIgHcIh4g=';

function measure(path: string, width: number, height: number): MeasuredMedia {
	const video = path.endsWith('.mp4');

	return {
		path,
		kind: video ? 'video' : 'image',
		width,
		height,
		...(video ? { duration: 12 } : {}),
		thumbhash: THUMBHASH,
		bytes: 1024,
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
