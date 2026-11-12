import { Text, View, type LayoutChangeEvent } from 'react-native';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { metro } from '@unbound-app/api';

import useStyles from '~/preview/chat-preview.style';
import { cardPadding, namesInside, rowInset, type BubbleAppearance } from '~/lib/style';
import type { PreviewPaint } from '~/preview/preview-paint';
import { BubbleLayout, TailPosition } from '~/lib/constants';

export type Size = { width: number; height: number };

type PreviewMessageProps = {
	author: string;
	avatarColor: string;
	text: string;
	mention: boolean;
	start: boolean;
	end: boolean;
	/** The space above the message: between groups or inside one. */
	gap: number;
	style: BubbleAppearance;
	/** How the bubble is drawn, once every sample bubble is measured. */
	paint: PreviewPaint | undefined;
	/** Reports the size the bubble's content asks for. */
	onMeasure: (size: Size) => void;
};

function BubbleShape({ paint }: { paint: PreviewPaint | undefined }) {
	const styles = useStyles();

	if (!paint) return null;

	const { Svg, Path } = metro.common.SVG;

	return (
		<Svg
			width={paint.svgWidth}
			height={paint.height}
			style={[styles.shape, { left: -paint.left }]}
		>
			<Path d={paint.fill} fill={paint.color} />
			{paint.outline ? (
				<Path
					d={paint.outline.path}
					fill='none'
					stroke={paint.outline.color}
					strokeWidth={paint.outline.width}
				/>
			) : null}
		</Svg>
	);
}

/**
 * @description One sample message of the settings preview: its avatar, name and text in a bubble drawn like the chat's.
 * @param props The message, its place in its group, the look and the bubble's paint.
 * @returns The message row.
 */
function PreviewMessage(props: PreviewMessageProps) {
	const { author, avatarColor, start, end, gap, style, paint, onMeasure } = props;
	const styles = useStyles();
	const card = style.layout === BubbleLayout.card;
	const tailRoom = style.tail === TailPosition.off ? 0 : style.tailSize;
	const showAvatar = style.avatarLast ? end : start;
	const name = (
		<Discord.Text variant='text-sm/semibold' style={styles.name}>
			{author}
		</Discord.Text>
	);
	const text = (
		<Discord.Text variant='text-sm/normal'>
			{props.mention ? <Text style={styles.mention}>@{messages.PREVIEW_YOU}</Text> : null}
			{props.mention ? ' ' : null}
			{props.text}
		</Discord.Text>
	);
	const avatar = (
		<View style={[styles.avatarSlot, style.avatarLast ? styles.avatarLast : null]}>
			{showAvatar ? (
				<View style={[styles.avatar, { backgroundColor: avatarColor }]}>
					<Text style={styles.initial}>{author.charAt(0)}</Text>
				</View>
			) : null}
		</View>
	);

	// A card spans the text column and holds the name, a few points around the content, as in the chat.
	const inside = start && (card || namesInside(style));
	const { horizontal, vertical } = card
		? {
				horizontal: cardPadding(style).horizontal + rowInset(style),
				vertical: cardPadding(style).vertical,
			}
		: { horizontal: style.horizontalPadding, vertical: style.verticalPadding };
	const measure = ({ nativeEvent: { layout } }: LayoutChangeEvent) =>
		onMeasure(
			card
				? { width: layout.width, height: layout.height }
				: { width: layout.width + horizontal * 2, height: layout.height + vertical * 2 },
		);

	return (
		<View style={[styles.row, { marginTop: gap }]}>
			<View style={{ marginRight: tailRoom }}>{avatar}</View>
			<View style={styles.column}>
				{start && !inside ? name : null}
				<View
					style={[
						card ? styles.card : styles.bubble,
						paint && !card ? { minWidth: paint.width } : null,
					]}
					onLayout={card ? measure : undefined}
				>
					<BubbleShape paint={paint} />
					<View
						style={[
							styles.content,
							{ marginHorizontal: horizontal, marginVertical: vertical },
						]}
						onLayout={card ? undefined : measure}
					>
						{inside ? name : null}
						{text}
					</View>
				</View>
			</View>
		</View>
	);
}

export default PreviewMessage;
