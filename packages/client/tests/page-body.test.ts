import { describe, expect, mock, test } from 'bun:test';
import type { ReactElement, ReactNode } from 'react';
import * as React from 'react';

import type { StorePage } from '~/marketplace/store-page';

import { MarkdownParser } from './helpers/discord-markdown';

function useMemo<T>(create: () => T): T {
	return create();
}

mock.module('react', () => ({ ...React, useMemo }));
mock.module('react-native', () => ({ View: 'View', Image: 'Image', Pressable: 'Pressable' }));
mock.module('~/metro/components', () => ({
	Discord: { createStyles: () => () => ({}), Text: 'Text' },
	Media: {},
	Video: {},
}));
mock.module('~/metro/common', () => ({ MarkdownParser, Theme: { colors: {}, radii: {} } }));

const { default: PageBody } = await import('~/ui/marketplace/page-body');
const { default: PageMedia } = await import('~/ui/marketplace/page-media');

type PageMediaProps = Parameters<typeof PageMedia>[0];

type FrameSize = {
	width?: number;
	height?: number;
};

type FrameStyle = FrameSize | (FrameSize | undefined)[] | undefined;

type Props = Partial<PageMediaProps> & {
	children?: ReactNode;
};

function page(body: string): StorePage {
	return {
		body,
		folder: 'https://cdn.unbound.rip/addons/acme.hello/1.0.0/',
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

function text(node: ReactNode): string {
	if (typeof node === 'string') {
		return node;
	}

	if (Array.isArray(node)) {
		return node.map(text).join('');
	}

	return React.isValidElement<Props>(node) ? text(node.props.children) : '';
}

function frameSize(style: FrameStyle): FrameSize {
	return Object.assign({}, ...[style ?? []].flat());
}

describe('a store page body on Discord 349', () => {
	test('renders bold in a paragraph without its asterisks', () => {
		const body = PageBody({ page: page('Some **bold** words') });
		const strong = elements(body).find((element) => element.type === 'strong');

		expect(text(body)).toBe('Some bold words');
		expect(strong?.props.children).toEqual(['bold']);
	});

	test('draws a mid-paragraph image at a non-zero size', () => {
		const body = PageBody({ page: page('A ![yellow](media/mid.png) inline image') });
		const media = elements(body).find(
			(element): element is ReactElement<PageMediaProps & Props> =>
				element.type === PageMedia,
		);

		if (!media) {
			throw new Error('The paragraph rendered no page media.');
		}

		const frame = PageMedia(media.props);
		const { width, height } = frameSize(frame.props.style);

		expect(width).toBeGreaterThan(0);
		expect(height).toBeGreaterThan(0);
	});

	test('shows the alt text of a mid-paragraph image the page did not measure', () => {
		const body = PageBody({ page: page('A ![Not measured](media/missing.png) here') });

		expect(text(body)).toBe('A Not measured here');
	});
});
