import type { MarkdownState } from '@unbound-app/types/markdown';
import { View } from 'react-native';
import { useMemo } from 'react';

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

/**
 * @description A store page's Markdown body, rendered by Discord's Markdown rules plus one for page
 * media. Lines that hold only an image or video lay out as blocks between the runs of text.
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
						<Discord.Text key={index} variant='text-md/normal'>
							{render(block.source, PARSE_INLINE, STATE)}
						</Discord.Text>
					);
				}

				const media = findPageMedia(page, block.path);

				return media ? <PageMedia key={index} media={media} alt={block.alt} /> : null;
			})}
		</View>
	);
}

export default PageBody;
