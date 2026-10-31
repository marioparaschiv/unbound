import type { AddonPage } from '@unbound-app/contracts/addon-page';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test } from 'bun:test';

import { getPinnedMediaBase, getPublishedMediaBase } from '~/lib/markdown-url';
import AddonGallery from '~/components/addon-gallery';
import { resolvePageMedia } from '~/lib/page-media';
import Markdown from '~/components/markdown';
import AddonMd from '~/components/addon-md';

import { PAGE, PAGE_PIN, PAGE_SHA, PAGE_SOURCE } from './helpers/addon-page';

const RAW = `https://raw.githubusercontent.com/acme/addons/${PAGE_SHA}/plugins/hello`;
const CDN = 'https://cdn.example/addons/acme.hello/1.2.0';
const PINNED_BASE = getPinnedMediaBase(PAGE_PIN);

function render(source: string, page?: AddonPage, mediaBase: string = PINNED_BASE): string {
	return renderToStaticMarkup(createElement(AddonMd, { source, pin: PAGE_PIN, mediaBase, page }));
}

function mediaTags(html: string): string[] {
	return [...html.matchAll(/<(?:img|video)\b[^>]*>/g)].map((match) => match[0]);
}

function attribute(tag: string, name: string): string | undefined {
	return new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1];
}

describe('AddonMd', () => {
	test('renders the banner, the gallery, then the inline image and video in order', () => {
		const sources = mediaTags(render(PAGE_SOURCE, PAGE)).map((tag) => attribute(tag, 'src'));

		expect(sources).toEqual([
			`${RAW}/media/banner.png`,
			`${RAW}/media/shot.png`,
			`${RAW}/media/tour.mp4`,
			`${RAW}/media/inline.png`,
			`${RAW}/media/clip.mp4`,
		]);
	});

	test('sizes every media box from its measurements, with the ThumbHash behind it', () => {
		const tags = mediaTags(render(PAGE_SOURCE, PAGE));
		const measured = new Map(PAGE.media.map((media) => [media.path, media]));

		expect(tags).toHaveLength(5);

		for (const tag of tags) {
			const path = attribute(tag, 'src')?.slice(RAW.length + 1) ?? '';
			const media = measured.get(path);

			expect([path, attribute(tag, 'width'), attribute(tag, 'height')]).toEqual([
				path,
				String(media?.width),
				String(media?.height),
			]);
			expect(attribute(tag, 'style')).toContain(
				`aspect-ratio:${media?.width} / ${media?.height}`,
			);
			expect(attribute(tag, 'style')).toContain(
				'background-image:url(data:image/png;base64,',
			);
		}
	});

	test('labels media with their alt text and gives a gallery video its poster', () => {
		const tags = mediaTags(render(PAGE_SOURCE, PAGE));

		expect(tags.map((tag) => attribute(tag, 'alt') ?? attribute(tag, 'aria-label'))).toEqual([
			'',
			'The settings screen',
			'A tour of the plugin',
			'Inline screenshot',
			'Inline clip',
		]);
		expect(attribute(tags[2] ?? '', 'poster')).toBe(`${RAW}/media/tour.png`);
		expect(tags[4]).toStartWith('<video');
	});

	test('loads media from the CDN version folder after publish', () => {
		const base = getPublishedMediaBase(`${CDN}/manifest.json`);
		const sources = mediaTags(render(PAGE_SOURCE, PAGE, base)).map((tag) =>
			attribute(tag, 'src'),
		);

		expect(base).toBe(`${CDN}/`);
		expect(sources).toHaveLength(5);

		for (const source of sources) {
			expect(source).toStartWith(`${CDN}/media/`);
		}
	});

	test('keeps unmeasured and external images as links and still renders tables', () => {
		const html = render(PAGE_SOURCE, PAGE);

		expect(html).toContain(
			`href="https://github.com/acme/addons/blob/${PAGE_SHA}/plugins/hello/media/missing.png"`,
		);
		expect(html).toContain('href="https://evil.example/pixel.png"');
		expect(html).not.toContain('src="https://evil.example');
		expect(html).toMatch(/<table[^>]*>.*<th[^>]*>Option<\/th>/s);
	});

	test('never shows the frontmatter as text', () => {
		for (const page of [PAGE, undefined]) {
			const html = render(PAGE_SOURCE, page);

			expect(html).not.toContain('banner:');
			expect(html).toMatch(/<h3[^>]*>Usage<\/h3>/);
		}
	});

	test('shows media as links until the page is measured', () => {
		const html = render(PAGE_SOURCE);

		expect(mediaTags(html)).toEqual([]);
		expect(html).toContain(
			`href="https://github.com/acme/addons/blob/${PAGE_SHA}/plugins/hello/media/inline.png"`,
		);
	});

	test('renders a page without frontmatter exactly as before', () => {
		const source = '## Setup\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n![shot](./shot.png)';

		expect(render(source)).toBe(
			renderToStaticMarkup(createElement(Markdown, { source, pin: PAGE_PIN })),
		);
	});

	test('keeps a leading rule that is not frontmatter, as before', () => {
		const source = '---\nIntro text.\n\nSection\n---\n\n| A | B |\n| --- | --- |\n| 1 | 2 |';
		const html = render(source);

		expect(html).toBe(renderToStaticMarkup(createElement(Markdown, { source, pin: PAGE_PIN })));
		expect(html).toContain('<hr');
		expect(html).toContain('Intro text.');
	});

	test('gives every gallery entry its own key when a file is listed twice', () => {
		const media = resolvePageMedia(PAGE, PINNED_BASE).get('media/shot.png');

		if (!media) {
			throw new Error('media/shot.png is not measured');
		}

		const entry = { media, alt: 'The settings screen', poster: undefined };
		const list = AddonGallery({ entries: [entry, entry] });
		const items: ReactElement[] = list.props.children;
		const keys = items.map((item) => item.key);

		expect(keys).toHaveLength(2);
		expect(new Set(keys).size).toBe(2);
	});
});
