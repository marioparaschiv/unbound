import { Children, Fragment, isValidElement, useMemo, type ReactNode } from 'react';
import type { MarkdownState } from '@unbound-app/types/markdown';
import { View } from 'react-native';

import { findPageMedia, splitPageBody, type StorePage } from '~/marketplace/store-page';
import { MarkdownParser } from '~/metro/common';
import { Discord } from '~/metro/components';

import { createPageMediaRule } from './page-media-rule';
import PageMedia from './page-media';

type PageBodyProps = {
	page: StorePage;
};

// Inline, as Discord parses messages: its `strong` and `em` rules are inline-only, and block parsing hands
// `**` to the any-scope `text` rule. Neither its heading nor its list rule checks `state.inline`.
const PARSE_INLINE = true;

const STATE: MarkdownState = { allowLinks: true, allowHeading: true, allowList: true };

// iOS sizes a view inside Text to the line box, which Discord's fixed line height keeps short, so media leave the Text.
function splitAtMedia(output: ReactNode): ReactNode[] {
	const parts: ReactNode[] = [];
	let line: ReactNode[] = [];

	function endLine() {
		if (!line.length) return;

		parts.push(
			<Discord.Text key={parts.length} variant='text-md/normal'>
				{line}
			</Discord.Text>,
		);
		line = [];
	}

	for (const node of Children.toArray(output)) {
		if (isValidElement(node) && node.type === PageMedia) {
			endLine();
			parts.push(node);
		} else {
			line.push(node);
		}
	}

	endLine();

	return parts;
}

/**
 * @description A store page's Markdown body, rendered by Discord's Markdown rules plus one for page
 * media. Every image or video lays out as a block between the runs of text, mid-sentence ones included.
 */
function PageBody({ page }: PageBodyProps) {
	const blocks = useMemo(() => splitPageBody(page.body), [page.body]);
	const render = useMemo(() => {
		const rules = MarkdownParser.defaultRules;

		return MarkdownParser.reactParserFor({
			...rules,
			pageMedia: createPageMediaRule(page, rules),
		});
	}, [page]);

	return (
		<View style={{ gap: 12 }}>
			{blocks.map((block, index) => {
				if (block.kind === 'markdown') {
					return (
						<Fragment key={index}>
							{splitAtMedia(render(block.source, PARSE_INLINE, STATE))}
						</Fragment>
					);
				}

				const media = findPageMedia(page, block.path);

				return media ? <PageMedia key={index} media={media} alt={block.alt} /> : null;
			})}
		</View>
	);
}

export default PageBody;
