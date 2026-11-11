import { describe, expect, mock, test } from 'bun:test';
import type { ReactElement, ReactNode } from 'react';
import * as React from 'react';

import type { PageRenderContext } from '~/ui/marketplace/render-page-inline';
import type { AddonPageContent } from '~/marketplace/addon-page';
import type { PageNode } from '~/marketplace/page-markdown';

mock.module('react-native', () => ({
	View: 'View',
	Text: 'RNText',
	ScrollView: 'ScrollView',
	Image: 'Image',
	Pressable: 'Pressable',
	StyleSheet: { hairlineWidth: 1 },
}));
mock.module('~/metro/components', () => ({
	Discord: { createStyles: () => () => ({}), Text: 'Text' },
	Media: {},
	Video: {},
}));
mock.module('~/metro/common', () => ({
	Theme: { colors: {}, radii: {} },
	Constants: { Fonts: {} },
	SVG: {},
}));
mock.module('~/metro/api', () => ({ Linking: {} }));

const { renderPageBlock } = await import('~/ui/marketplace/render-page-block');
const { default: useStyles } = await import('~/ui/marketplace/page-markdown.style');
const { default: PageMedia } = await import('~/ui/marketplace/page-media');
const { default: PageIcon } = await import('~/ui/marketplace/page-icon');

type Props = {
	children?: ReactNode;
	name?: string;
	svg?: string;
	alt?: string;
};

const GEAR_SVG = '<svg viewBox="0 0 20 20"><circle r="2"/></svg>';

const PAGE: AddonPageContent = {
	body: '',
	folder: 'https://cdn.unbound.rip/addons/acme.hello/1.0.0/',
	icons: new Map([['gear', GEAR_SVG]]),
	measured: {
		frontmatter: { banner: 'media/mid.png', media: [] },
		media: [
			{
				path: 'media/mid.png',
				kind: 'image',
				width: 320,
				height: 240,
				thumbhash: 'IhUKMphwd3eIiHiIgHcIh4g=',
				bytes: 64,
			},
		],
	},
};

const ctx: PageRenderContext = { page: PAGE, styles: useStyles() };

const text = (content: string): PageNode => ({ type: 'text', content });

function render(node: PageNode): ReactNode {
	return renderPageBlock(node, ctx, 0);
}

function elements(node: ReactNode): ReactElement<Props>[] {
	if (Array.isArray(node)) {
		return node.flatMap(elements);
	}

	if (!React.isValidElement<Props>(node)) {
		return [];
	}

	return [node, ...elements(node.props.children)];
}

function textOf(node: ReactNode): string {
	if (typeof node === 'string') {
		return node;
	}

	if (Array.isArray(node)) {
		return node.map(textOf).join('');
	}

	return React.isValidElement<Props>(node) ? textOf(node.props.children) : '';
}

describe('a addon page block', () => {
	test('lays a measured image out between the runs of text around it', () => {
		const block = render({
			type: 'paragraph',
			content: [
				text('A '),
				{ type: 'image', alt: 'Mid', target: 'media/mid.png' },
				text(' image'),
			],
		});
		const lines = elements(block).filter((element) => element.type === 'Text');
		const media = elements(block).find((element) => element.type === PageMedia);

		expect(media?.props.alt).toBe('Mid');
		expect(lines.flatMap((line) => elements(line.props.children))).not.toContain(media);
		expect(lines.map((line) => textOf(line)).join('|')).toBe('A|image');
	});

	test('reads an image the page did not measure as its alt text', () => {
		const block = render({
			type: 'paragraph',
			content: [text('A '), { type: 'image', alt: 'Missing', target: 'media/x.png' }],
		});

		expect(textOf(block)).toBe('A Missing');
	});

	test('draws the icon a list item opens with in place of its bullet', () => {
		const block = render({
			type: 'list',
			ordered: false,
			items: [[{ type: 'pageIcon', name: 'gear' }, text(' Settings')], [text('Plain')]],
		});
		const icons = elements(block).filter((element) => element.type === PageIcon);

		expect(icons.map((icon) => icon.props.svg)).toEqual([GEAR_SVG]);
		expect(textOf(block)).toBe('Settings•Plain');
	});

	test('keeps the bullet when the sprite has no such icon', () => {
		const block = render({
			type: 'list',
			ordered: false,
			items: [[{ type: 'pageIcon', name: 'bell' }, text(' Pings')]],
		});

		expect(elements(block).some((element) => element.type === PageIcon)).toBe(false);
		expect(textOf(block)).toBe('•Pings');
	});

	test('numbers an ordered list from its start', () => {
		const block = render({
			type: 'list',
			ordered: true,
			start: 3,
			items: [[text('a')], [text('b')]],
		});

		expect(textOf(block)).toBe('3.a4.b');
	});

	test('renders bold, code and a link inside one line', () => {
		const block = render({
			type: 'paragraph',
			content: [
				{ type: 'strong', content: [text('Bold')] },
				text(' '),
				{ type: 'inlineCode', content: 'x' },
				text(' '),
				{ type: 'link', target: 'https://unbound.rip', content: [text('site')] },
			],
		});

		expect(textOf(block)).toBe('Bold  x  site');
		expect(elements(block).filter((element) => element.type === 'Text')).toHaveLength(1);
	});
});
