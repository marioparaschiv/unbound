import { flux, metro } from '@unbound-app/api';
import { Platform, Text, View } from 'react-native';

import { TooltipStyle } from '@unbound-plugins/shared/tooltips/tooltip-layout';

export type TooltipBubbleProps = {
	arrowDirection: 'UP' | 'DOWN';
	arrowOffset: number;
	label: string;
	width: number;
};

type ThemeStore = { theme?: string };

const ARROW_HALF_WIDTH = 8;
const PADDING = { horizontal: 14, vertical: 10 };
const RADIUS = 8;
const SYSTEM_FONT = Platform.select({ android: 'sans-serif', default: 'System' });

function resolveColor(token: string): string {
	const { Theme } = metro.common;
	const theme = (flux.getStore('Theme') as unknown as ThemeStore).theme ?? Theme.themes.DARK;

	return Theme.internal.resolveSemanticColor(theme, Theme.colors[token]);
}

function Arrow({
	direction,
	offset,
	color,
}: {
	direction: 'UP' | 'DOWN';
	offset: number;
	color: string;
}) {
	return (
		<View
			style={{
				marginLeft: Math.max(RADIUS, offset),
				width: 0,
				height: 0,
				borderLeftWidth: ARROW_HALF_WIDTH,
				borderRightWidth: ARROW_HALF_WIDTH,
				borderLeftColor: 'transparent',
				borderRightColor: 'transparent',
				...(direction === 'UP'
					? { borderBottomWidth: TooltipStyle.arrowHeight, borderBottomColor: color }
					: { borderTopWidth: TooltipStyle.arrowHeight, borderTopColor: color }),
			}}
		/>
	);
}

/**
 * @description A tooltip bubble in Discord's colors, mounted on its own Fabric surface over the window. It draws without animations, since the surface can unmount at any moment.
 * @param props Where the arrow points, the text, and the bubble width.
 * @returns The tooltip.
 */
function TooltipBubble({ arrowDirection, arrowOffset, label, width }: TooltipBubbleProps) {
	const background = resolveColor('BACKGROUND_SURFACE_HIGHEST');
	const arrow = <Arrow direction={arrowDirection} offset={arrowOffset} color={background} />;

	return (
		<View style={{ width }}>
			{arrowDirection === 'UP' ? arrow : null}
			<View
				style={{
					backgroundColor: background,
					borderRadius: RADIUS,
					paddingHorizontal: PADDING.horizontal,
					paddingVertical: PADDING.vertical,
				}}
			>
				<Text
					allowFontScaling={false}
					style={{
						color: resolveColor('TEXT_DEFAULT'),
						fontFamily: SYSTEM_FONT,
						fontSize: TooltipStyle.fontSize,
					}}
				>
					{label}
				</Text>
			</View>
			{arrowDirection === 'DOWN' ? arrow : null}
		</View>
	);
}

export default TooltipBubble;
