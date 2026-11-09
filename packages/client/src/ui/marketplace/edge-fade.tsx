import { View } from 'react-native';

import { SVG } from '~/metro/common';

import useStyles from './edge-fade.style';

type EdgeFadeProps = {
	side: 'start' | 'end';
	visible: boolean;
};

/**
 * @description A scroll shadow over one end of a horizontal scroller: the card's colour fading to clear,
 * hinting that more content hides past that edge. Lets touches through to the scroller.
 * Renders nothing while hidden, so a row that fits draws no gradients.
 */
function EdgeFade({ side, visible }: EdgeFadeProps) {
	const styles = useStyles();

	if (!visible) return null;

	const id = `unbound-edge-fade-${side}`;
	const color = styles.card.color;

	return (
		<View
			pointerEvents='none'
			style={[styles.fade, side === 'start' ? styles.start : styles.end]}
		>
			<SVG.Svg width='100%' height='100%'>
				<SVG.Defs>
					<SVG.LinearGradient id={id} x1='0' y1='0' x2='1' y2='0'>
						<SVG.Stop
							offset='0'
							stopColor={color}
							stopOpacity={side === 'start' ? 1 : 0}
						/>
						<SVG.Stop
							offset='1'
							stopColor={color}
							stopOpacity={side === 'start' ? 0 : 1}
						/>
					</SVG.LinearGradient>
				</SVG.Defs>
				<SVG.Rect x='0' y='0' width='100%' height='100%' fill={`url(#${id})`} />
			</SVG.Svg>
		</View>
	);
}

export default EdgeFade;
