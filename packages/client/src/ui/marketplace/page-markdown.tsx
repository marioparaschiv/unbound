import { memo, useMemo } from 'react';
import { View } from 'react-native';

import type { StorePage } from '~/marketplace/store-page';

import { parsePageMarkdown } from './parse-page-markdown';
import { renderPageBlock } from './render-page-block';
import useStyles from './page-markdown.style';

type PageMarkdownProps = {
	page: StorePage;
};

/**
 * @description A store page's ADDON.md body as the website renders it: headings, lists, code, quotes,
 * tables, links, measured media and the `:name:` icons, laid out natively.
 */
function PageMarkdown({ page }: PageMarkdownProps) {
	const styles = useStyles();
	const blocks = useMemo(() => parsePageMarkdown(page.body), [page.body]);
	const ctx = { page, styles };

	return (
		<View style={styles.body}>
			{blocks.map((node, index) => renderPageBlock(node, ctx, index))}
		</View>
	);
}

export default memo(PageMarkdown);
