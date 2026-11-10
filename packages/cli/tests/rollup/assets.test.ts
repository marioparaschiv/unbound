import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import type { AddonAsset } from '@unbound-app/types/addons';
import type { OutputAsset, RollupLog } from 'rollup';
import { dirname, join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { rollup } from 'rollup';
import sharp from 'sharp';

import { unbound } from '~/rollup/preset';

type Built = {
	code: string;
	manifest: { assets?: Record<string, AddonAsset> };
	files: Map<string, Uint8Array>;
	warnings: string[];
};

let pluginRoot = '';

beforeEach(async () => {
	pluginRoot = await mkdtemp(join(tmpdir(), 'rollup-assets-'));
	await mkdir(join(pluginRoot, 'src'));
	await writeFile(join(pluginRoot, 'manifest.json'), '{"id":"assets.test","main":"index.ts"}');
});

afterEach(async () => {
	await rm(pluginRoot, { recursive: true, force: true });
});

async function image(path: string, width: number, height: number, format: 'png' | 'webp' = 'png') {
	const full = join(pluginRoot, path);
	const pixels = sharp({
		create: { width, height, channels: 4, background: { r: width, g: height, b: 0, alpha: 1 } },
	});

	await mkdir(dirname(full), { recursive: true });
	await writeFile(full, await pixels[format]().toBuffer());
}

async function build(entry: string): Promise<Built> {
	await writeFile(join(pluginRoot, 'src', 'index.ts'), entry);

	const warnings: string[] = [];
	const { output: outputOptions, ...config } = unbound(
		pathToFileURL(join(pluginRoot, 'rollup.config.mjs')).href,
		{ bytecode: false },
	);
	const bundle = await rollup({
		...config,
		onwarn: (warning: RollupLog) => void warnings.push(warning.message),
	});
	const { output } = await bundle.generate(
		Array.isArray(outputOptions) ? {} : (outputOptions ?? {}),
	);

	await bundle.close();

	const assets = output.filter((file): file is OutputAsset => file.type === 'asset');
	const manifest = assets.find((file) => file.fileName === 'manifest.json');
	const files = new Map(
		assets
			.filter((file) => file.fileName !== 'manifest.json')
			.map((file) => [file.fileName, new Uint8Array(file.source as Uint8Array)]),
	);

	return {
		code: output[0].code,
		manifest: JSON.parse(String(manifest?.source)),
		files,
		warnings,
	};
}

function sha256(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

test('an imported image becomes its registered id, and ships with its @2x sibling', async () => {
	await image('assets/icons/star.png', 24, 20);
	await image('assets/icons/star@2x.png', 48, 40);

	const built = await build(`
import star from '../assets/icons/star.png';
export function start() { return star; }
`);
	const asked: string[] = [];
	const unbound = { assets: { getIdByName: (name: string) => (asked.push(name), 42) } };
	const plugin: { start: () => number } = runInNewContext(`(${built.code})`, {
		unbound,
	}).__load();
	const scales = built.manifest.assets?.['icons/star']?.scales ?? {};

	expect(plugin.start()).toBe(42);
	expect(asked).toEqual(['icons/star']);
	expect(built.manifest.assets).toEqual({
		'icons/star': { type: 'png', width: 24, height: 20, scales: expect.any(Object) },
	});
	expect(Object.keys(scales)).toEqual(['1', '2']);

	for (const digest of Object.values(scales)) {
		const file = built.files.get(`assets/${digest}.png`);

		expect(file && sha256(file)).toBe(digest);
	}
});

test('imports an image that only ships at @3x by its plain name, measured in points', async () => {
	await image('src/images/logo@3x.webp', 90, 60, 'webp');

	const built = await build(`
import logo from '~/images/logo.webp';
export function start() { return logo; }
`);

	expect(built.manifest.assets).toEqual({
		'src/images/logo': {
			type: 'webp',
			width: 30,
			height: 20,
			scales: { 3: expect.any(String) },
		},
	});
});

test('ships an assets/ image the bundle names, leaves out one it never mentions, and dedupes equal files', async () => {
	await image('assets/named.png', 8, 8);
	await image('assets/copy.png', 8, 8);
	await image('assets/unused.png', 4, 4);

	const built = await build(`
const kind = 'un';
export function start() { return [unbound.assets.getIdByName('named'), unbound.assets.getIdByName(\`copy\`), unbound.assets.getIdByName(\`\${kind}used\`), 'not-unused']; }
`);

	expect(Object.keys(built.manifest.assets ?? {})).toEqual(['copy', 'named']);
	expect(built.files.size).toBe(1);
	expect(built.warnings.join('\n')).toContain('assets/unused.png  is not imported');
});

test('a plugin without images gets no assets field', async () => {
	const built = await build('export function start() {}');

	expect(built.manifest.assets).toBeUndefined();
	expect(built.files.size).toBe(0);
});

test('rejects an image format Image cannot draw, naming the ones it can', async () => {
	await writeFile(join(pluginRoot, 'src', 'logo.bmp'), 'BM');

	expect(
		build(`import logo from './logo.bmp'; export function start() { return logo; }`),
	).rejects.toThrow(
		/logo\.bmp is bmp, which React Native's Image cannot draw; plugins ship png, jpg, webp or gif images, and svg as components/,
	);
});

test('an svg in assets/ that nothing imports does not ship', async () => {
	await mkdir(join(pluginRoot, 'assets'));
	await writeFile(
		join(pluginRoot, 'assets', 'logo.svg'),
		'<svg xmlns="http://www.w3.org/2000/svg"/>',
	);

	const built = await build("export function start() { return 'logo'; }");

	expect(built.manifest.assets).toBeUndefined();
});
