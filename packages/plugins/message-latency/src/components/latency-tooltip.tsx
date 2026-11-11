import { Tooltips } from '~/lib/modules';
import { resolveColor } from '~/lib/theme';

export type LatencyTooltipProps = {
	arrowDirection: 'UP' | 'DOWN';
	arrowOffset: number;
	label: string;
	width: number;
};

/**
 * @description Discord's tooltip bubble, mounted on its own Fabric surface over the message list.
 * @param props Where the arrow points, the text, and the bubble width.
 * @returns The tooltip, or nothing when Discord moved its tooltip module.
 */
function LatencyTooltip({ arrowDirection, arrowOffset, label, width }: LatencyTooltipProps) {
	if (!Tooltips) return null;

	const background = resolveColor('BACKGROUND_SURFACE_HIGHEST');

	return (
		<Tooltips.Tooltip
			arrowDirection={arrowDirection}
			arrowOffset={arrowOffset}
			arrowPosition={Tooltips.TooltipArrowPositions.LEFT}
			arrowStyle={{ borderBottomColor: background, borderTopColor: background }}
			containerStyle={{ backgroundColor: background }}
			label={label}
			labelStyle={{ color: resolveColor('TEXT_DEFAULT') }}
			style={{ width }}
		/>
	);
}

export default LatencyTooltip;
