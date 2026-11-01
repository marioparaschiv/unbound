import { toString } from 'mdast-util-to-string';
import GithubSlugger from 'github-slugger';
import { visit } from 'unist-util-visit';
import type { Root } from 'mdast';

import type { GuideHeading } from '../src/lib/guides/guide-meta';

/**
 * @description Gives every heading of a guide a GitHub-style slug as its id, and lists the h2s and h3s.
 * @param tree The guide's mdast; its headings are changed in place.
 * @returns The h2 and h3 headings in document order.
 */
export function collectGuideHeadings(tree: Root): GuideHeading[] {
	const slugger = new GithubSlugger();
	const toc: GuideHeading[] = [];

	visit(tree, 'heading', (node) => {
		const text = toString(node);
		const slug = slugger.slug(text);

		node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: slug } };

		if (node.depth === 2 || node.depth === 3) {
			toc.push({ depth: node.depth, text, slug });
		}
	});

	return toc;
}

/**
 * @description The remark plugin form of {@link collectGuideHeadings}, so rendered headings carry the ids the table of contents links to.
 * @returns The transformer.
 */
function remarkGuideHeadings() {
	return (tree: Root) => {
		collectGuideHeadings(tree);
	};
}

export default remarkGuideHeadings;
