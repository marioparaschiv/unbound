import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import type { SharedValue } from 'react-native-reanimated';
import { View } from 'react-native';

import useStyles from './blurred-icon.style';
import BlurCopy from './blur-copy';

type BlurredIconProps = {
	source: ImageSourcePropType;
	/** How blurred the icon is, from 0 (sharp) to 1. */
	amount: SharedValue<number>;
	/** The tint, from the caller's style sheet. */
	style?: StyleProp<ImageStyle>;
};

/** How far the outer ring of copies spreads at full blur, in points. */
const RADIUS = 5;

/**
 * Rings of copies from the centre out, each fainter, like a gaussian's falloff. Denser rings outward keep
 * neighbouring copies close enough to merge rather than read as separate ghosts.
 */
const RINGS = [
	{ count: 4, distance: 1 / 3, opacity: 0.14 },
	{ count: 8, distance: 2 / 3, opacity: 0.1 },
	{ count: 12, distance: 1, opacity: 0.07 },
];

const COPIES = RINGS.flatMap(({ count, distance, opacity }, ring) =>
	Array.from({ length: count }, (_, index) => {
		// Each ring starts half a step round from the last, so no two line up.
		const angle = ((index + ring / 2) / count) * 2 * Math.PI;

		return {
			x: Math.cos(angle) * RADIUS * distance,
			y: Math.sin(angle) * RADIUS * distance,
			opacity,
		};
	}),
);

/**
 * @description A tinted icon that blurs by spreading faint copies of itself around a fading centre. Image
 * `blurRadius` drops the icon's transparency on both platforms, so the tint would fill its whole square.
 */
function BlurredIcon({ source, amount, style }: BlurredIconProps) {
	const styles = useStyles();

	return (
		<View style={styles.icon}>
			<BlurCopy source={source} amount={amount} style={style} x={0} y={0} opacity={0.25} />
			{COPIES.map(({ x, y, opacity }) => (
				<BlurCopy
					key={`${x}:${y}`}
					source={source}
					amount={amount}
					style={style}
					x={x}
					y={y}
					opacity={opacity}
				/>
			))}
		</View>
	);
}

export default BlurredIcon;
