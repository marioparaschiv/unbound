import type { ReactNode } from 'react';
import { Text } from 'react-native';

import type { PageNode } from '~/marketplace/page-markdown';
import type { StorePage } from '~/marketplace/store-page';
import { Linking } from '~/metro/api';

import type useStyles from './page-markdown.style';

import PageIcon from './page-icon';

/** What rendering a page's nodes reads besides the nodes: the page its media resolve against, and its styles. */
export type PageRenderContext = {
	page: StorePage;
	styles: ReturnType<typeof useStyles>;
};

const OPENABLE = /^(?:https?:|mailto:)/i;

// Only absolute links open; a path relative to the repository has nothing to open from the CDN.
function renderLink(target: string, children: ReactNode, ctx: PageRenderContext, key: number) {
	if (!OPENABLE.test(target)) {
		return <Text key={key}>{children}</Text>;
	}

	return (
		<Text
			key={key}
			style={ctx.styles.link}
			accessibilityRole='link'
			onPress={() => void Linking.openURL(target)}
		>
			{children}
		</Text>
	);
}

function renderNode(node: PageNode, ctx: PageRenderContext, key: number): ReactNode {
	const { styles } = ctx;

	switch (node.type) {
		case 'text': {
			return node.content;
		}
		case 'strong': {
			return (
				<Text key={key} style={styles.strong}>
					{renderPageInline(node.content, ctx)}
				</Text>
			);
		}
		case 'em': {
			return (
				<Text key={key} style={styles.em}>
					{renderPageInline(node.content, ctx)}
				</Text>
			);
		}
		case 'u': {
			return (
				<Text key={key} style={styles.underline}>
					{renderPageInline(node.content, ctx)}
				</Text>
			);
		}
		case 'del': {
			return (
				<Text key={key} style={styles.del}>
					{renderPageInline(node.content, ctx)}
				</Text>
			);
		}
		case 'inlineCode': {
			return (
				<Text key={key} style={styles.inlineCode}>
					{` ${node.content} `}
				</Text>
			);
		}
		case 'link': {
			return renderLink(node.target, renderPageInline(node.content, ctx), ctx, key);
		}
		// An image the page did not measure reads as its alt text, linked where it can open.
		case 'image': {
			return renderLink(node.target, node.alt || node.target, ctx, key);
		}
		// A version published before sprites has none, so its icons are left out.
		case 'pageIcon': {
			const svg = ctx.page.icons.get(node.name);

			return svg ? <PageIcon key={key} svg={svg} /> : null;
		}
		case 'br': {
			return '\n';
		}
		default: {
			return null;
		}
	}
}

/**
 * @description Renders inline nodes as nested text: marks, code, links and page icons.
 * @param nodes The inline nodes, in order.
 * @param ctx The page and its styles.
 * @returns The rendered nodes, to sit inside one `Text`.
 */
export function renderPageInline(nodes: PageNode[], ctx: PageRenderContext): ReactNode[] {
	return nodes.map((node, index) => renderNode(node, ctx, index));
}
