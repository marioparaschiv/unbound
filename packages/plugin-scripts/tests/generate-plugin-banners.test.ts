import { describe, expect, test } from 'bun:test';

import {
	bannerSvg,
	isGeneratedBanner,
	markGenerated,
	parseBannerArgs,
	renderBanner,
	shouldDrawBanner,
	withBannerFrontmatter,
	wrapLines,
} from '~/generate-plugin-banners';

const icon = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
).toString('base64');

describe('wrapLines', () => {
	test('wraps on words and ellipsises what does not fit', () => {
		expect(wrapLines('aaa bbb ccc', 7, 3)).toEqual(['aaa bbb', 'ccc']);
		expect(wrapLines('aaa bbb ccc ddd', 7, 1)).toEqual(['aaa bb…']);
	});
});

describe('bannerSvg', () => {
	test('escapes text and is deterministic', () => {
		const content = { name: 'A & B', description: '<b>hi</b>', iconBase64: icon };
		const svg = bannerSvg(content);

		expect(svg).toContain('A &amp; B');
		expect(svg).toContain('&lt;b&gt;hi&lt;/b&gt;');
		expect(bannerSvg(content)).toBe(svg);
	});
});

describe('renderBanner', () => {
	test('renders a 1200x400 marked PNG the same way twice', () => {
		const png = renderBanner(
			bannerSvg({ name: 'Sample', description: 'Text.', iconBase64: icon }),
		);
		const view = new DataView(png.buffer, png.byteOffset);

		expect(view.getUint32(16)).toBe(1200);
		expect(view.getUint32(20)).toBe(400);
		expect(isGeneratedBanner(png)).toBe(true);
		expect(
			renderBanner(bannerSvg({ name: 'Sample', description: 'Text.', iconBase64: icon })),
		).toEqual(png);
	});

	test('does not treat an unmarked PNG as generated', () => {
		const plain = renderBanner(
			'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
		);
		const unmarked = Buffer.concat([plain.subarray(0, 33), plain.subarray(plain.length - 12)]);

		expect(isGeneratedBanner(unmarked)).toBe(false);
		expect(isGeneratedBanner(markGenerated(unmarked))).toBe(true);
	});
});

describe('withBannerFrontmatter', () => {
	test('prepends frontmatter once and keeps the body', () => {
		const body = '## What it does\n';
		const once = withBannerFrontmatter(body);

		expect(once).toBe(`---\nbanner: media/banner.png\n---\n\n${body}`);
		expect(withBannerFrontmatter(once)).toBe(once);
	});
});

describe('shouldDrawBanner', () => {
	const generated = markGenerated(
		renderBanner(bannerSvg({ name: 'A', description: 'B', iconBase64: icon })),
	);
	const handMade = new Uint8Array([1, 2, 3]);

	test('draws only missing banners by default', () => {
		const selection = parseBannerArgs([]);

		expect(shouldDrawBanner('a', undefined, selection)).toBe(true);
		expect(shouldDrawBanner('a', generated, selection)).toBe(false);
		expect(shouldDrawBanner('a', handMade, selection)).toBe(false);
	});

	test('redraws named plugins, or every generated banner with --all, and never hand-made ones', () => {
		expect(shouldDrawBanner('a', generated, parseBannerArgs(['a']))).toBe(true);
		expect(shouldDrawBanner('b', generated, parseBannerArgs(['a']))).toBe(false);
		expect(shouldDrawBanner('b', undefined, parseBannerArgs(['a']))).toBe(false);
		expect(shouldDrawBanner('b', generated, parseBannerArgs(['--all']))).toBe(true);
		expect(shouldDrawBanner('b', handMade, parseBannerArgs(['--all']))).toBe(false);
	});
});
