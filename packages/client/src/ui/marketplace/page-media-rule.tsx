import type { MarkdownNode, MarkdownRule, MarkdownRules } from '@unbound-app/types/markdown';

import { findPageMedia, type StorePage } from '~/marketplace/store-page';

import PageMedia from './page-media';

type PageMediaNode = MarkdownNode & {
	alt: string;
	path: string;
};

const MEDIA = /^!\[([^\]\n]*)\]\(\s*([^)\s]+)\s*\)/;

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
	const orders = Object.values(rules).map((rule) => rule.order);

	return {
		order: Math.min(0, ...orders) - 1,
		match: (source) => MEDIA.exec(source),
		parse: ([, alt = '', path = '']) => ({ type: 'pageMedia', alt, path }),
		react(node, _output, state) {
			const media = findPageMedia(page, node.path);

			return media ? <PageMedia key={state.key} media={media} alt={node.alt} /> : node.alt;
		},
	};
}

export default { createPageMediaRule };
