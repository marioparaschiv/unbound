import { describe, expect, test } from 'bun:test';

import type { AddonPage, MeasuredMedia } from '../src/addon-page';

import {
	parseAddonPage,
	addonPageSchema,
	splitFrontmatter,
	measuredMediaSchema,
	addonPageFrontmatterSchema,
} from '../src/addon-page';

const thumbhash = '1QcSHQRnh493V4dIh4eXh1h4kJUI';

function measure(path: string, width: number, height: number): MeasuredMedia {
	const video = path.endsWith('.mp4') || path.endsWith('.webm');

	return {
		path,
		kind: video ? 'video' : 'image',
		width,
		height,
		...(video ? { duration: 12.5 } : {}),
		thumbhash,
		bytes: 40_000,
	};
}

const frontmatter = {
	banner: 'media/banner.png',
	media: [
		{ image: 'media/settings.png', alt: 'The settings page' },
		{ video: 'media/demo.mp4', poster: 'media/demo-poster.jpg', alt: 'A short demo' },
	],
};

const banner = measure('media/banner.png', 1500, 500);
const settings = measure('media/settings.png', 1080, 1920);
const demo = measure('media/demo.mp4', 1920, 1080);
const poster = measure('media/demo-poster.jpg', 1920, 1080);
const media = [banner, settings, demo, poster];

function issuePaths(page: AddonPage): string[] {
	const parsed = addonPageSchema.safeParse(page);

	return parsed.success ? [] : parsed.error.issues.map((issue) => issue.path.join('.'));
}

describe('addonPageSchema', () => {
	test('accepts a page whose media are all measured and in shape', () => {
		expect(addonPageSchema.safeParse({ frontmatter, media }).success).toBe(true);
	});

	test('accepts a banner of exactly 1200x400 and media at the 9:16 and 21:9 bounds', () => {
		const page = {
			frontmatter: {
				banner: 'media/banner.png',
				media: [
					{ image: 'media/tall.png', alt: 'Tall' },
					{ image: 'media/wide.png', alt: 'Wide' },
				],
			},
			media: [
				measure('media/banner.png', 1200, 400),
				measure('media/tall.png', 900, 1600),
				measure('media/wide.png', 2100, 900),
			],
		};

		expect(issuePaths(page)).toEqual([]);
	});

	test('rejects a banner that is not exactly 3:1', () => {
		const page = {
			frontmatter,
			media: [measure('media/banner.png', 1500, 501), settings, demo, poster],
		};

		expect(issuePaths(page)).toEqual(['frontmatter.banner']);
	});

	test('rejects a 3:1 banner smaller than 1200x400', () => {
		const page = {
			frontmatter,
			media: [measure('media/banner.png', 900, 300), settings, demo, poster],
		};

		expect(issuePaths(page)).toEqual(['frontmatter.banner']);
	});

	test('rejects gallery media taller than 9:16 or wider than 21:9', () => {
		const page = {
			frontmatter,
			media: [
				banner,
				measure('media/settings.png', 899, 1600),
				measure('media/demo.mp4', 2101, 900),
				poster,
			],
		};

		expect(issuePaths(page)).toEqual(['frontmatter.media.0', 'frontmatter.media.1']);
	});

	test('rejects frontmatter media that were not measured', () => {
		expect(issuePaths({ frontmatter, media: [banner, settings, demo] })).toEqual([
			'frontmatter.media.1.poster',
		]);
		expect(issuePaths({ frontmatter, media: [settings, demo, poster] })).toEqual([
			'frontmatter.banner',
		]);
	});

	test('rejects a file measured twice', () => {
		expect(issuePaths({ frontmatter, media: [...media, banner] })).toEqual(['media.4.path']);
	});
});

describe('addonPageFrontmatterSchema', () => {
	test('rejects a missing banner', () => {
		const parsed = addonPageFrontmatterSchema.safeParse({ media: frontmatter.media });

		expect(parsed.success).toBe(false);
		expect(parsed.error?.issues.map((issue) => issue.path)).toEqual([['banner']]);
	});

	test('defaults media to an empty gallery', () => {
		expect(addonPageFrontmatterSchema.parse({ banner: 'media/banner.png' })).toEqual({
			banner: 'media/banner.png',
			media: [],
		});
	});

	test('rejects a title or description, which come from the manifest', () => {
		for (const key of ['title', 'description']) {
			const parsed = addonPageFrontmatterSchema.safeParse({ ...frontmatter, [key]: 'Hello' });

			expect({ key, success: parsed.success }).toEqual({ key, success: false });
		}
	});

	test('rejects unknown media extensions and the wrong kind of media', () => {
		const pages = [
			{ ...frontmatter, banner: 'media/banner.bmp' },
			{ ...frontmatter, banner: 'media/banner.mp4' },
			{ ...frontmatter, media: [{ image: 'media/shot.tiff', alt: 'A shot' }] },
			{ ...frontmatter, media: [{ video: 'media/demo.mov', alt: 'A demo' }] },
			{ ...frontmatter, media: [{ image: 'media/demo.webm', alt: 'A demo' }] },
			{
				...frontmatter,
				media: [{ video: 'media/demo.mp4', poster: 'media/p.mp4', alt: 'A' }],
			},
		];

		for (const page of pages) {
			expect({ page, success: addonPageFrontmatterSchema.safeParse(page).success }).toEqual({
				page,
				success: false,
			});
		}
	});

	test('rejects paths outside media/ and external URLs', () => {
		const banners = [
			'banner.png',
			'media/../banner.png',
			'media/.hidden.png',
			'/media/banner.png',
			'https://example.com/media/banner.png',
		];

		for (const banner of banners) {
			const parsed = addonPageFrontmatterSchema.safeParse({ banner });

			expect({ banner, success: parsed.success }).toEqual({ banner, success: false });
		}
	});

	test('rejects a gallery entry without alt text or with both an image and a video', () => {
		const entries = [
			{ image: 'media/shot.png' },
			{ image: 'media/shot.png', alt: '  ' },
			{ image: 'media/shot.png', video: 'media/demo.mp4', alt: 'Both' },
			{ image: 'media/shot.png', poster: 'media/poster.png', alt: 'Poster on an image' },
		];

		for (const entry of entries) {
			const parsed = addonPageFrontmatterSchema.safeParse({ ...frontmatter, media: [entry] });

			expect({ entry, success: parsed.success }).toEqual({ entry, success: false });
		}
	});
});

describe('measuredMediaSchema', () => {
	test('reads the kind from the extension, case-insensitively', () => {
		expect(measuredMediaSchema.safeParse(measure('media/SHOT.PNG', 10, 10)).success).toBe(true);
		expect(
			measuredMediaSchema.safeParse({ ...measure('media/shot.png', 10, 10), kind: 'video' })
				.success,
		).toBe(false);
	});

	test('rejects an unknown extension, a duration on an image, and empty sizes', () => {
		const entries = [
			{ ...measure('media/shot.png', 10, 10), path: 'media/shot.svg' },
			{ ...measure('media/shot.png', 10, 10), duration: 3 },
			measure('media/shot.png', 0, 10),
			{ ...measure('media/shot.png', 10, 10), bytes: 0 },
			{ ...measure('media/shot.png', 10, 10), thumbhash: 'not base64!' },
		];

		for (const entry of entries) {
			expect({ entry, success: measuredMediaSchema.safeParse(entry).success }).toEqual({
				entry,
				success: false,
			});
		}
	});
});

describe('splitFrontmatter', () => {
	test('cuts the YAML between the leading fences from the body', () => {
		expect(splitFrontmatter('---\nbanner: media/b.png\n---\n# Hi\n')).toEqual({
			frontmatter: 'banner: media/b.png',
			body: '# Hi\n',
		});
		expect(splitFrontmatter('\uFEFF---\r\na: 1\r\n---\r\nBody')).toEqual({
			frontmatter: 'a: 1',
			body: 'Body',
		});
		expect(splitFrontmatter('---\n---\nBody')).toEqual({ frontmatter: '', body: 'Body' });
		expect(splitFrontmatter('---\na: 1\n---')).toEqual({ frontmatter: 'a: 1', body: '' });
	});

	test('leaves a page without leading fences as all body', () => {
		for (const source of ['Body only', '\n---\na: 1\n---\n', '---\na: 1\n', '--- \na: 1']) {
			expect(splitFrontmatter(source)).toEqual({ frontmatter: undefined, body: source });
		}
	});

	test('ends the frontmatter at the first closing fence', () => {
		expect(splitFrontmatter('---\na: 1\n---\nText\n---\nMore')).toEqual({
			frontmatter: 'a: 1',
			body: 'Text\n---\nMore',
		});
	});
});

describe('parseAddonPage', () => {
	test('reads a valid page into typed frontmatter and its body', () => {
		const source = [
			'---',
			'banner: media/banner.png',
			'media:',
			'  - image: media/settings.png',
			'    alt: The settings page',
			'  - video: media/demo.mp4',
			'    poster: media/demo-poster.jpg',
			'    alt: A short demo',
			'---',
			'Some **Markdown**.',
		].join('\n');

		expect(parseAddonPage(source)).toEqual({
			success: true,
			frontmatter,
			body: 'Some **Markdown**.',
		});
	});

	test('refuses a page without a banner', () => {
		for (const source of ['Just a body.', '---\nmedia: []\n---\nBody']) {
			const parsed = parseAddonPage(source);

			expect({ source, success: parsed.success }).toEqual({ source, success: false });
			expect(parsed.success ? '' : parsed.error).toContain('banner');
		}
	});

	test('refuses invalid YAML and duplicate keys', () => {
		const sources = [
			'---\nbanner: [media/banner.png\n---\n',
			'---\nbanner: media/a.png\nbanner: media/b.png\n---\n',
		];

		for (const source of sources) {
			const { success } = parseAddonPage(source);

			expect({ source, success }).toEqual({ source, success: false });
		}
	});

	test('refuses an unknown media extension', () => {
		const parsed = parseAddonPage('---\nbanner: media/banner.tiff\n---\n');

		expect(parsed.success).toBe(false);
	});
});
