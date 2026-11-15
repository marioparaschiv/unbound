import { Text, View } from 'react-native';

import { Tooltip } from '~/lib/constants';
import { resolveColor } from '~/lib/theme';

export type LatencyTooltipProps = {
	arrowDirection: 'UP' | 'DOWN';
	arrowOffset: number;
	label: string;
	width: number;
};

const ARROW_HALF_WIDTH = 8;
const PADDING = { horizontal: 14, vertical: 10 };
const RADIUS = 8;

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
					? { borderBottomWidth: Tooltip.arrowHeight, borderBottomColor: color }
					: { borderTopWidth: Tooltip.arrowHeight, borderTopColor: color }),
			}}
		/>
	);
}

/**
 * @description A tooltip bubble in Discord's colors, mounted on its own Fabric surface over the message list. It draws without animations, since the surface can unmount at any moment.
 * @param props Where the arrow points, the text, and the bubble width.
 * @returns The tooltip.
 */
function LatencyTooltip({ arrowDirection, arrowOffset, label, width }: LatencyTooltipProps) {
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
				<Text style={{ color: resolveColor('TEXT_DEFAULT'), fontSize: Tooltip.fontSize }}>
					{label}
				</Text>
			</View>
			{arrowDirection === 'DOWN' ? arrow : null}
		</View>
	);
}

export default LatencyTooltip;
