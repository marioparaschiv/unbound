import registerAppSurface from '@unbound-plugins/shared/native/app-surface';
import { Image, Pressable, ScrollView, Text, View, type TextStyle } from 'react-native';
import { useSyncExternalStore } from 'react';
import type { ThemedToken } from 'shiki';

import type { IconMode, LineOverflow } from '~/preferences';
import type { ThemeAppearance, TokenLines } from '~/highlighter';
import { CODE_LINE_HEIGHT, CODE_SIDE_PADDING, codeBlockLayout } from '~/layout';
import { languageLabel } from '~/languages';
import devicons from '~/devicons.json';
import { cssColor } from '~/card-colors';
import { copyCode } from '~/clipboard';
import { Palette } from '~/constants';

export type CardContent = {
	code: string;
	copyText: string;
	language: string;
	tokens: TokenLines | null;
	width: number;
	appearance: ThemeAppearance;
	opacity: number;
	overflow: LineOverflow;
	iconMode: IconMode;
};

export type CardSource = {
	card(surfaceId: string): CardContent | undefined;
	revision(surfaceId: string): number;
	subscribe(surfaceId: string, listener: () => void): () => void;
};

type CodeCardProps = {
	surfaceId: string;
};

const HEADER_HEIGHT = 34;
const CODE_TOP = 42;
const SIDE_PADDING = CODE_SIDE_PADDING;
const COPY_WIDTH = 58;
const deviconLanguages: Record<string, string> = devicons.languages;
const deviconImages: Record<string, string> = devicons.images;

const codeText: TextStyle = {
	fontFamily: 'monospace',
	fontSize: 12,
	lineHeight: CODE_LINE_HEIGHT,
	includeFontPadding: false,
};

function plainLines(code: string): ThemedToken[][] {
	return code.split('\n').map((content) => [{ content, offset: 0 }]);
}

function tokenStyle(token: ThemedToken, foreground: string): TextStyle {
	const fontStyle = token.fontStyle ?? 0;

	return {
		color: token.color ?? foreground,
		...(fontStyle & 1 ? { fontStyle: 'italic' } : {}),
		...(fontStyle & 2 ? { fontWeight: 'bold' } : {}),
		...(fontStyle & 4 ? { textDecorationLine: 'underline' } : {}),
	};
}

function CodeLines({ card, wraps }: { card: CardContent; wraps: boolean }) {
	const palette = Palette[card.appearance.light ? 'light' : 'dark'];
	const lines = card.tokens ?? plainLines(card.code);

	return (
		<View>
			{lines.map((line, index) => (
				<View key={index} style={{ flexDirection: 'row' }}>
					<Text
						allowFontScaling={false}
						style={[codeText, { color: palette.lineNumber }]}
					>
						{`${String(index + 1).padStart(2, ' ')} `}
					</Text>
					<Text
						allowFontScaling={false}
						style={[
							codeText,
							{ color: card.appearance.foreground },
							wraps ? { flexShrink: 1 } : null,
						]}
					>
						{line.map((token, tokenIndex) => (
							<Text
								key={tokenIndex}
								style={tokenStyle(token, card.appearance.foreground)}
							>
								{token.content}
							</Text>
						))}
					</Text>
				</View>
			))}
		</View>
	);
}

function CodeArea({ card }: { card: CardContent }) {
	const layout = codeBlockLayout(card.code, card.width, card.overflow);
	const viewportWidth = card.width - SIDE_PADDING * 2;
	const viewportHeight = layout.height - 50;
	const scrollsSideways = card.overflow === 'scroll';
	const scrollsDown = layout.contentHeight > viewportHeight;
	const frame = {
		position: 'absolute',
		left: SIDE_PADDING,
		top: CODE_TOP,
		width: viewportWidth,
	} as const;

	if (!scrollsSideways && !scrollsDown) {
		return (
			<View style={[frame, { height: layout.contentHeight, justifyContent: 'center' }]}>
				<CodeLines card={card} wraps />
			</View>
		);
	}

	const lines = scrollsSideways ? (
		<ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
			<CodeLines card={card} wraps={false} />
		</ScrollView>
	) : (
		<CodeLines card={card} wraps />
	);

	return (
		<View style={[frame, { height: viewportHeight }]}>
			{scrollsDown ? (
				<ScrollView nestedScrollEnabled showsVerticalScrollIndicator>
					{lines}
				</ScrollView>
			) : (
				lines
			)}
		</View>
	);
}

function Header({ card }: { card: CardContent }) {
	const background = cssColor(card.appearance.background, card.opacity / 100);
	const iconName = card.iconMode === 'disabled' ? undefined : deviconLanguages[card.language];
	const icon = iconName ? deviconImages[iconName] : undefined;
	const labelX = icon ? 34 : SIDE_PADDING;
	const label: TextStyle = { color: card.appearance.foreground, fontSize: 11 };

	return (
		<View style={{ height: HEADER_HEIGHT, backgroundColor: background }}>
			{icon ? (
				<Image
					source={{ uri: `data:image/png;base64,${icon}` }}
					resizeMode='contain'
					style={{
						position: 'absolute',
						left: SIDE_PADDING,
						top: 9,
						width: 16,
						height: 16,
						...(card.iconMode === 'greyscale'
							? { tintColor: card.appearance.foreground }
							: {}),
					}}
				/>
			) : null}
			<View
				style={{
					position: 'absolute',
					left: labelX,
					width: card.width - labelX - 76,
					height: HEADER_HEIGHT,
					justifyContent: 'center',
				}}
			>
				<Text
					allowFontScaling={false}
					numberOfLines={1}
					style={[label, { fontWeight: '600' }]}
				>
					{languageLabel(card.language)}
				</Text>
			</View>
			<Pressable
				onPress={() => void copyCode(card.copyText)}
				style={{
					position: 'absolute',
					left: card.width - 70,
					width: COPY_WIDTH,
					height: HEADER_HEIGHT,
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<Text allowFontScaling={false} style={[label, { fontWeight: '500' }]}>
					Copy
				</Text>
			</Pressable>
		</View>
	);
}

/**
 * @description Registers the root component Fabric surfaces mount to draw code cards like the iOS ones.
 * @param source Looks up each surface's card and tells the surface when it changes.
 * @returns The registered module name to mount, or `undefined` when React Native refused it.
 */
export function registerCodeCardSurface(source: CardSource): string | undefined {
	function CodeCardSurface({ surfaceId }: CodeCardProps) {
		useSyncExternalStore(
			(listener) => source.subscribe(surfaceId, listener),
			() => source.revision(surfaceId),
		);

		const card = source.card(surfaceId);

		if (!card) return <View style={{ height: 1 }} />;

		const layout = codeBlockLayout(card.code, card.width, card.overflow);

		return (
			<View
				style={{
					width: card.width,
					height: layout.height,
					borderRadius: 8,
					overflow: 'hidden',
					backgroundColor: cssColor(card.appearance.background, card.opacity / 100),
				}}
			>
				<Header card={card} />
				<CodeArea card={card} />
			</View>
		);
	}

	return registerAppSurface('ShikiCodeCardSurface', CodeCardSurface);
}

export default { registerCodeCardSurface };
