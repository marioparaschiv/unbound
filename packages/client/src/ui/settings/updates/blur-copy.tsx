import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';

import useStyles from './blurred-icon.style';

type BlurCopyProps = {
	source: ImageSourcePropType;
	amount: SharedValue<number>;
	style?: StyleProp<ImageStyle>;
	/** Where the copy sits at full blur, in points from the centre; the centre copy sits at 0, 0. */
	x: number;
	y: number;
	/** The copy's opacity at full blur. */
	opacity: number;
};

/**
 * @description One copy of a {@link BlurredIcon}. The centre copy fades from opaque to `opacity` as the blur
 * grows; a ring copy fades in from nothing to `opacity` while sliding out to its offset.
 */
function BlurCopy({ source, amount, style, x, y, opacity }: BlurCopyProps) {
	const styles = useStyles();
	const centre = x === 0 && y === 0;
	const motion = useAnimatedStyle(() => ({
		opacity: centre ? 1 - amount.value * (1 - opacity) : amount.value * opacity,
		transform: [{ translateX: x * amount.value }, { translateY: y * amount.value }],
	}));

	return <Animated.Image source={source} style={[styles.copy, style, motion]} />;
}

export default BlurCopy;
