import { Fragment, type ReactNode } from 'react';
import { ScrollView, View } from 'react-native';

import {
	groupRuns,
	splitLeadingIcon,
	type PageList,
	type PageNode,
} from '~/marketplace/page-markdown';
import { findPageMedia } from '~/marketplace/store-page';
import { Discord } from '~/metro/components';

import { renderPageInline, type PageRenderContext } from './render-page-inline';
import PageMedia from './page-media';
import PageIcon from './page-icon';

type TextVariant =
	| 'heading-xl/bold'
	| 'heading-lg/bold'
	| 'heading-md/semibold'
	| 'text-md/semibold';

// Headings shift down a level, as on the website: the addon's name is the page's only title.
const HEADING_VARIANTS: Record<number, TextVariant> = {
	1: 'heading-lg/bold',
	2: 'heading-lg/bold',
	3: 'heading-md/semibold',
};

const LEADING_SPACE = /^\s+/;
const TRAILING_SPACE = /\s+$/;

function trimText(node: PageNode, edge: RegExp): PageNode {
	return node.type === 'text' ? { type: 'text', content: node.content.replace(edge, '') } : node;
}

// A line starts and ends at the blocks around it, so the space beside a nested list or image is dropped.
function trimRun(nodes: PageNode[]): PageNode[] {
	return nodes.map((node, index) => {
		const start = index === 0 ? trimText(node, LEADING_SPACE) : node;

		return index === nodes.length - 1 ? trimText(start, TRAILING_SPACE) : start;
	});
}

function renderText(nodes: PageNode[], ctx: PageRenderContext, key: number): ReactNode {
	return (
		<Discord.Text key={key} variant='text-md/normal' style={ctx.styles.text}>
			{renderPageInline(trimRun(nodes), ctx)}
		</Discord.Text>
	);
}

// iOS sizes a view inside Text to the line box, so measured media leave the text as blocks.
function renderFlow(nodes: PageNode[], ctx: PageRenderContext): ReactNode[] {
	const isMedia = (node: PageNode) =>
		node.type === 'image' && findPageMedia(ctx.page, node.target) !== undefined;

	return groupRuns(nodes, isMedia).map((run, index) =>
		run.kind === 'inline'
			? renderText(run.nodes, ctx, index)
			: renderPageBlock(run.node, ctx, index),
	);
}

function renderList(list: PageList, ctx: PageRenderContext, key: number): ReactNode {
	const { styles } = ctx;
	const start = list.start ?? 1;

	return (
		<View key={key} style={styles.list}>
			{list.items.map((item, index) => {
				const { icon, rest } = splitLeadingIcon(item);
				const svg = icon ? ctx.page.icons.get(icon) : undefined;

				return (
					<View key={index} style={styles.item}>
						<View style={styles.marker}>
							{svg ? (
								<PageIcon svg={svg} />
							) : (
								<Discord.Text variant='text-md/semibold' style={styles.bullet}>
									{list.ordered ? `${start + index}.` : '•'}
								</Discord.Text>
							)}
						</View>
						<View style={styles.itemBody}>{renderFlow(rest, ctx)}</View>
					</View>
				);
			})}
		</View>
	);
}

function renderHeading(level: number, content: PageNode[], ctx: PageRenderContext, key: number) {
	const { styles } = ctx;
	const { icon, rest } = splitLeadingIcon(content);
	const svg = icon ? ctx.page.icons.get(icon) : undefined;

	return (
		<View key={key} style={styles.heading} accessibilityRole='header'>
			{svg ? <PageIcon svg={svg} size={level <= 2 ? 20 : 18} /> : null}
			<Discord.Text
				variant={HEADING_VARIANTS[level] ?? 'text-md/semibold'}
				style={styles.headingText}
			>
				{renderPageInline(rest, ctx)}
			</Discord.Text>
		</View>
	);
}

function renderTable(rows: PageNode[][][], ctx: PageRenderContext, key: number): ReactNode {
	const { styles } = ctx;

	return (
		<ScrollView key={key} horizontal showsHorizontalScrollIndicator={false}>
			<View style={styles.table}>
				{rows.map((row, index) => (
					<View key={index} style={[styles.row, index === 0 ? styles.headerRow : null]}>
						{row.map((cell, column) => (
							<View key={column} style={styles.cell}>
								<Discord.Text
									variant={index === 0 ? 'text-sm/semibold' : 'text-sm/normal'}
									style={styles.text}
								>
									{renderPageInline(cell, ctx)}
								</Discord.Text>
							</View>
						))}
					</View>
				))}
			</View>
		</ScrollView>
	);
}

/**
 * @description Renders one block node of a store page: a heading, paragraph, list, code block, quote,
 * rule, table or measured image.
 * @param node The node.
 * @param ctx The page and its styles.
 * @param key The React key among its siblings.
 * @returns The rendered block, or `null` for nodes that draw nothing, such as link definitions.
 */
export function renderPageBlock(node: PageNode, ctx: PageRenderContext, key: number): ReactNode {
	const { styles, page } = ctx;

	switch (node.type) {
		case 'heading': {
			return renderHeading(node.level, node.content, ctx, key);
		}
		case 'paragraph': {
			return <Fragment key={key}>{renderFlow(node.content, ctx)}</Fragment>;
		}
		case 'list': {
			return renderList(node, ctx, key);
		}
		case 'codeBlock': {
			return (
				<ScrollView
					key={key}
					horizontal
					showsHorizontalScrollIndicator={false}
					style={styles.codeBlock}
				>
					<Discord.Text variant='text-sm/normal' style={styles.code}>
						{node.content}
					</Discord.Text>
				</ScrollView>
			);
		}
		case 'blockQuote': {
			return (
				<View key={key} style={styles.quote}>
					{renderFlow(node.content, ctx)}
				</View>
			);
		}
		case 'hr': {
			return <View key={key} style={styles.rule} />;
		}
		case 'table': {
			return renderTable([node.header, ...node.cells], ctx, key);
		}
		// At its own size, never wider than the column, as the website draws it.
		case 'image': {
			const media = findPageMedia(page, node.target);

			return media ? (
				<PageMedia
					key={key}
					media={media}
					alt={node.alt}
					style={[styles.media, { width: media.width }]}
				/>
			) : null;
		}
		default: {
			return null;
		}
	}
}

export default { renderPageBlock };
