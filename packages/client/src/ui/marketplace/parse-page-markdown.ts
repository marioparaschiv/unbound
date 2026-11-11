import type { MarkdownRule, SimpleMarkdownParser } from '@unbound-app/types/markdown';

import { normalizePageBody } from '~/marketplace/store-page';
import type { PageNode } from '~/marketplace/page-markdown';
import { isPageIcon } from '~/marketplace/page-icons';
import { SimpleMarkdown } from '~/metro/common';

const ICON = /^:([a-z0-9]+(?:-[a-z0-9]+)*):/;

let parser: SimpleMarkdownParser<PageNode> | undefined;

// Discord's message rules turn `:gear:` into emoji and skip tables and code blocks, so a page parses
// with simple-markdown's document rules, plus `:name:` for the icons the website draws.
function createParser(): SimpleMarkdownParser<PageNode> {
	const { defaultRules } = SimpleMarkdown;
	const matchIcon = SimpleMarkdown.inlineRegex(ICON);
	const pageIcon: MarkdownRule = {
		// Before `text`, which stops at every colon, so a name outside the set reads on as text.
		order: (defaultRules.text?.order ?? 0) - 0.5,
		match(source, state, previous) {
			const capture = matchIcon(source, state, previous);

			return capture && isPageIcon(capture[1] ?? '') ? capture : null;
		},
		parse: ([, name]) => ({ type: 'pageIcon', name }),
	};

	return SimpleMarkdown.parserFor<PageNode>({ ...defaultRules, pageIcon });
}

/**
 * @description Parses a store page's body into block nodes, building the parser on first use.
 * @param body ADDON.md after its frontmatter.
 * @returns The page's blocks in order.
 */
export function parsePageMarkdown(body: string): PageNode[] {
	parser ??= createParser();

	return parser(normalizePageBody(body), { inline: false });
}
