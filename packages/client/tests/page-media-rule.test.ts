import type { MarkdownOutput, MarkdownRule, MarkdownRules } from '@unbound-app/types/markdown';
import { describe, expect, mock, test } from 'bun:test';
import { isValidElement } from 'react';

import type { StorePage } from '~/marketplace/store-page';

mock.module('react-native', () => ({ Image: () => null, Pressable: () => null }));
mock.module('~/metro/components', () => ({
	Discord: { createStyles: () => () => ({}) },
	Media: {},
	Video: {},
}));
mock.module('~/metro/common', () => ({ Theme: { colors: {}, radii: {} } }));

const { createPageMediaRule } = await import('~/ui/marketplace/page-media-rule');
const { default: PageMedia } = await import('~/ui/marketplace/page-media');

const FOLDER = 'https://cdn.unbound.rip/addons/acme.hello/1.0.0/';

const page: StorePage = {
	body: '',
	folder: FOLDER,
	measured: {
		frontmatter: { banner: 'media/shot.png', media: [] },
		media: [
			{
				path: 'media/shot.png',
				kind: 'image',
				width: 1500,
				height: 500,
				thumbhash: 'IhUKMphwd3eIiHiIgHcIh4g=',
				bytes: 64,
			},
		],
	},
};

const noop: MarkdownRule['match'] = () => null;
const rules: MarkdownRules = {
	link: { order: 17, match: noop, parse: () => ({ type: 'link' }) },
	paragraph: { order: 3, match: noop, parse: () => ({ type: 'paragraph' }) },
};
const output: MarkdownOutput = () => null;

function render(source: string) {
	const rule = createPageMediaRule(page, rules);
	const capture = rule.match(source, {}, '');

	if (!capture) {
		throw new Error(`${source} did not match.`);
	}

	return rule.react?.(
		rule.parse(capture, () => [], {}),
		output,
		{ key: 0 },
	);
}

describe('the page media rule', () => {
	test('runs before every rule it joins, so link never takes an image', () => {
		expect(createPageMediaRule(page, rules).order).toBeLessThan(3);
	});

	test('renders a measured image from the version folder', () => {
		const element = render('![The settings](media/shot.png) and more');

		expect(isValidElement(element)).toBe(true);
		expect(element).toMatchObject({
			type: PageMedia,
			props: {
				alt: 'The settings',
				media: { path: 'media/shot.png', url: `${FOLDER}media/shot.png` },
			},
		});
	});

	test('shows the alt text for a file the page did not measure', () => {
		expect(render('![Elsewhere](https://evil.example/pixel.png)')).toBe('Elsewhere');
	});

	test('leaves a plain link to the link rule', () => {
		expect(createPageMediaRule(page, rules).match('[text](media/shot.png)', {}, '')).toBeNull();
	});
});
