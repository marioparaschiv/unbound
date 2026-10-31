import type { MarkdownNode, MarkdownRule, MarkdownRules } from '@unbound-app/types/markdown';

import { findPageMedia, type PageMediaFile, type StorePage } from '~/marketplace/store-page';

import PageMedia from './page-media';

type PageMediaNode = MarkdownNode & {
	alt: string;
	path: string;
};

const MEDIA = /^!\[([^\]\n]*)\]\(\s*([^)\s]+)\s*\)/;
// Inside Text a view lays out as an attachment with no width of its own, so it needs an explicit size.
const INLINE_SIZE = 200;

function inlineSize({ width, height }: PageMediaFile) {
	const scale = Math.min(1, INLINE_SIZE / Math.max(width, height));

	return { width: width * scale, height: height * scale };
}

/**
 * @description Builds the Markdown rule for `![alt](media/…)`: a file the page measured renders as an
 * image or video, anything else as its alt text. It runs before every default rule, so `link` never sees it.
 * @param page The store page the paths resolve against.
 * @param rules The rules it joins, to order it first.
 * @returns The rule.
 */
export function createPageMediaRule(
	page: StorePage,
	rules: MarkdownRules,
): MarkdownRule<PageMediaNode> {
	const orders = Object.values(rules).flatMap(({ order }) => order ?? []);

	return {
		order: Math.min(0, ...orders) - 1,
		match: (source) => MEDIA.exec(source),
		parse: ([, alt = '', path = '']) => ({ type: 'pageMedia', alt, path }),
		react(node, _output, state) {
			const media = findPageMedia(page, node.path);

			if (!media) {
				return node.alt;
			}

			return (
				<PageMedia key={state.key} media={media} alt={node.alt} style={inlineSize(media)} />
			);
		},
	};
}

export default { createPageMediaRule };
