import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { addonPageSchema } from '@unbound-app/contracts/addon-page';
import { afterEach, describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

import { createTempDir, runUbd, type TempDir } from './helpers/ubd';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

const HAS_FFMPEG = spawnSync('ffmpeg', ['-version']).status === 0;
const ADDON = 'plugins/my-plugin';

type Format = 'png' | 'jpeg' | 'webp' | 'gif';

type Image = {
	width: number;
	height: number;
	format?: Format;
};

type Fixture = {
	page: string;
	images?: Record<string, Image>;
	videos?: Record<string, Image>;
	static?: boolean;
};

const BANNER = { width: 1500, height: 500 };

async function renderImage({ width, height, format = 'png' }: Image): Promise<Buffer> {
	const image = sharp({
		create: { width, height, channels: 4, background: { r: 200, g: 40, b: 90, alpha: 1 } },
	});

	return image.toFormat(format).toBuffer();
}

function renderVideo(path: string, { width, height }: Image) {
	const result = spawnSync('ffmpeg', [
		'-v',
		'error',
		'-f',
		'lavfi',
		'-i',
		`color=c=blue:s=${width}x${height}:d=1`,
		'-c:v',
		'libx264',
		'-pix_fmt',
		'yuv420p',
		path,
	]);

	if (result.status !== 0) {
		throw new Error(`ffmpeg failed: ${result.stderr.toString()}`);
	}
}

async function workspace(fixture: Fixture): Promise<TempDir> {
	const files: Record<string, string> = {
		'unbound.config.json': JSON.stringify({ addons: ['plugins/*'], build: 'true' }),
		[`${ADDON}/manifest.json`]: JSON.stringify({
			id: 'example.my-plugin',
			name: 'My Plugin',
			description: 'An example plugin.',
			authors: [{ name: 'example', id: '1' }],
			version: '1.0.0',
			main: fixture.static ? 'index.js' : 'src/index.tsx',
		}),
		[`${ADDON}/ADDON.md`]: fixture.page,
	};

	if (fixture.static) {
		files[`${ADDON}/index.js`] = 'export default {};';
	} else {
		files[`${ADDON}/package.json`] = JSON.stringify({ scripts: { build: 'true' } });
		files[`${ADDON}/src/index.tsx`] = 'export default {};';
	}

	const dir = createTempDir(files);

	dirs.push(dir);

	for (const [path, image] of Object.entries(fixture.images ?? {})) {
		const file = join(dir.path, ADDON, path);

		mkdirSync(dirname(file), { recursive: true });
		writeFileSync(file, await renderImage(image));
	}

	for (const [path, video] of Object.entries(fixture.videos ?? {})) {
		const file = join(dir.path, ADDON, path);

		mkdirSync(dirname(file), { recursive: true });
		renderVideo(file, video);
	}

	return dir;
}

function page(frontmatter: string, body = 'A plugin.\n'): string {
	return `---\n${frontmatter}\n---\n\n${body}`;
}

async function build(fixture: Fixture, env: Record<string, string> = {}) {
	const dir = await workspace(fixture);
	const result = await runUbd(['build'], dir.path, env);
	const output = join(dir.path, ADDON, fixture.static ? '' : 'dist', 'page.json');

	return { ...result, dir, output };
}

describe('ubd build measures ADDON.md media', () => {
	test('writes a page.json that validates against the page contract', async () => {
		const result = await build({
			page: page(
				[
					'banner: media/banner.png',
					'media:',
					'  - image: media/screens/settings.jpg',
					'    alt: The settings page',
					'  - image: media/wide.webp',
					'    alt: A wide view',
				].join('\n'),
				'## Usage\n\n![An animation](media/demo.gif)\n',
			),
			images: {
				'media/banner.png': BANNER,
				'media/screens/settings.jpg': { width: 540, height: 960, format: 'jpeg' },
				'media/wide.webp': { width: 840, height: 360, format: 'webp' },
				'media/demo.gif': { width: 160, height: 90, format: 'gif' },
			},
		});

		expect(result.stderr).toBe('');
		expect(result.exitCode).toBe(0);

		const parsed = addonPageSchema.safeParse(JSON.parse(readFileSync(result.output, 'utf8')));

		if (!parsed.success) {
			throw new Error(`page.json does not match the contract: ${parsed.error.message}`);
		}

		const sizeOf = (path: string) => statSync(join(result.dir.path, ADDON, path)).size;

		expect(parsed.data.media.map(({ thumbhash: _, ...media }) => media)).toEqual([
			{
				path: 'media/banner.png',
				kind: 'image',
				width: 1500,
				height: 500,
				bytes: sizeOf('media/banner.png'),
			},
			{
				path: 'media/screens/settings.jpg',
				kind: 'image',
				width: 540,
				height: 960,
				bytes: sizeOf('media/screens/settings.jpg'),
			},
			{
				path: 'media/wide.webp',
				kind: 'image',
				width: 840,
				height: 360,
				bytes: sizeOf('media/wide.webp'),
			},
			{
				path: 'media/demo.gif',
				kind: 'image',
				width: 160,
				height: 90,
				bytes: sizeOf('media/demo.gif'),
			},
		]);
	});

	test('a static addon writes page.json next to its manifest', async () => {
		const result = await build({
			static: true,
			page: page('banner: media/banner.png'),
			images: { 'media/banner.png': BANNER },
		});

		expect(result.exitCode).toBe(0);
		expect(
			addonPageSchema.safeParse(JSON.parse(readFileSync(result.output, 'utf8'))).success,
		).toBe(true);
	});

	test.skipIf(!HAS_FFMPEG)('measures a video and its poster', async () => {
		const result = await build({
			page: page(
				[
					'banner: media/banner.png',
					'media:',
					'  - video: media/demo.mp4',
					'    poster: media/poster.png',
					'    alt: A demo',
				].join('\n'),
			),
			images: { 'media/banner.png': BANNER, 'media/poster.png': { width: 320, height: 320 } },
			videos: { 'media/demo.mp4': { width: 320, height: 180 } },
		});

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toContain(
			'warning [page] The poster media/poster.png is 320x320 but its video media/demo.mp4 is 320x180',
		);

		const written = addonPageSchema.parse(JSON.parse(readFileSync(result.output, 'utf8')));
		const video = written.media.find((media) => media.path === 'media/demo.mp4');

		expect(video).toMatchObject({ kind: 'video', width: 320, height: 180 });
		expect(video?.duration).toBeCloseTo(1, 1);
	});

	test('a page without frontmatter warns and writes no page.json', async () => {
		const result = await build({ page: 'A plugin.\n' });

		expect(result.exitCode).toBe(0);
		expect(result.stderr).toContain('warning [page] ADDON.md has no frontmatter');
		expect(existsSync(result.output)).toBe(false);
	});
});

type Rejection = {
	name: string;
	fixture: Fixture;
	env?: Record<string, string>;
	message: string;
};

const REJECTIONS: Rejection[] = [
	{
		name: 'a missing media file',
		fixture: { page: page('banner: media/banner.png') },
		message: 'error [page] media/banner.png does not exist.',
	},
	{
		name: 'an external image',
		fixture: {
			page: page('banner: media/banner.png', '![Logo](https://example.com/logo.png)\n'),
			images: { 'media/banner.png': BANNER },
		},
		message:
			'error [page] ADDON.md shows https://example.com/logo.png, which is not in the repository',
	},
	{
		name: 'an image outside media/',
		fixture: {
			page: page('banner: media/banner.png', '![Shot](shot.png)\n'),
			images: { 'media/banner.png': BANNER },
		},
		message:
			'error [page] ADDON.md shows shot.png: Must be a relative path inside the media/ folder.',
	},
	{
		name: 'a table',
		fixture: {
			page: page('banner: media/banner.png', '| Key | Value |\n| --- | --- |\n| a | b |\n'),
			images: { 'media/banner.png': BANNER },
		},
		message: 'error [page] ADDON.md has a table at "| Key | Value |"',
	},
	{
		name: 'a leading H1',
		fixture: {
			page: page('banner: media/banner.png', '# My Plugin\n\nA plugin.\n'),
			images: { 'media/banner.png': BANNER },
		},
		message: 'error [page] ADDON.md starts with the heading "# My Plugin"',
	},
	{
		name: 'a title in the frontmatter',
		fixture: {
			page: page('title: My Plugin\nbanner: media/banner.png'),
			images: { 'media/banner.png': BANNER },
		},
		message: 'error [page] ADDON.md has invalid frontmatter:',
	},
	{
		name: 'a banner that is not 3:1',
		fixture: {
			page: page('banner: media/banner.png'),
			images: { 'media/banner.png': { width: 1600, height: 900 } },
		},
		message: 'error [page] The banner must be exactly 3:1 and at least 1200x400',
	},
	{
		name: 'a gallery image taller than 9:16',
		fixture: {
			page: page(
				'banner: media/banner.png\nmedia:\n  - image: media/tall.png\n    alt: A tall image',
			),
			images: { 'media/banner.png': BANNER, 'media/tall.png': { width: 100, height: 400 } },
		},
		message: 'error [page] Media must be between 9:16 and 21:9; media/tall.png is 100x400.',
	},
	{
		name: 'a file whose contents do not match its extension',
		fixture: {
			page: page('banner: media/banner.jpg'),
			images: { 'media/banner.jpg': BANNER },
		},
		message: 'error [page] media/banner.jpg is not a jpg file; its contents are png.',
	},
	{
		name: 'a file over the per-file limit',
		fixture: {
			page: page('banner: media/banner.png'),
			images: { 'media/banner.png': BANNER },
		},
		env: { ADDON_MEDIA_MAX_BYTES: '10' },
		message: 'bytes; a media file may be at most 10 bytes.',
	},
	{
		name: 'media over the per-addon limit',
		fixture: {
			page: page('banner: media/banner.png'),
			images: { 'media/banner.png': BANNER },
		},
		env: { ADDON_MEDIA_TOTAL_MAX_BYTES: '10' },
		message: "bytes together; an addon's media may take at most 10 bytes.",
	},
	{
		name: 'an invalid media limit in the environment',
		fixture: {
			page: page('banner: media/banner.png'),
			images: { 'media/banner.png': BANNER },
		},
		env: { ADDON_MEDIA_MAX_BYTES: 'many' },
		message: 'error [page] The check crashed: Invalid environment',
	},
];

async function expectRejected(dir: TempDir, env: Record<string, string>, message: string) {
	const output = join(dir.path, ADDON, 'dist', 'page.json');

	mkdirSync(join(dir.path, ADDON, 'dist'));
	writeFileSync(output, '{"stale":true}');

	const result = await runUbd(['build'], dir.path, env);

	expect(result.exitCode).not.toBe(0);
	expect(result.stderr).toContain(message);
	expect(existsSync(output)).toBe(false);
}

describe('ubd build rejects a broken ADDON.md', () => {
	for (const rejection of REJECTIONS) {
		test(rejection.name, async () => {
			const dir = await workspace(rejection.fixture);

			await expectRejected(dir, rejection.env ?? {}, rejection.message);
		});
	}

	test.skipIf(!HAS_FFMPEG)('a video whose length ffprobe cannot read', async () => {
		const dir = await workspace({
			page: page(
				'banner: media/banner.png\nmedia:\n  - video: media/demo.webm\n    alt: A demo',
			),
			images: { 'media/banner.png': BANNER },
		});
		const streamed = spawnSync('ffmpeg', [
			'-v',
			'error',
			'-f',
			'lavfi',
			'-i',
			'color=c=blue:s=320x180:d=1',
			'-c:v',
			'libvpx',
			'-f',
			'webm',
			'pipe:1',
		]);

		if (streamed.status !== 0) {
			throw new Error(`ffmpeg failed: ${streamed.stderr.toString()}`);
		}

		writeFileSync(join(dir.path, ADDON, 'media/demo.webm'), streamed.stdout);

		await expectRejected(
			dir,
			{},
			'error [page] media/demo.webm has no length; a video must play for longer than zero seconds.',
		);
	});
});
