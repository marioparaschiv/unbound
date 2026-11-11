import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import type { ImageURISource } from 'react-native';

import TintedIcon from '~/metro/fallbacks/tinted-icon';

import { SLOT_WIDTH, slotOffset } from './marquee-slots';
import useStyles from './icon-marquee-slot.style';

type IconMarqueeSlotProps = {
	source: ImageURISource;
	slot: number;
	slots: number;
	progress: SharedValue<number>;
	/** The row's width, which a reversed row mirrors its slots across. */
	width: number;
	reverse: boolean;
};

/**
 * @description One round icon button in a marquee row, placed on the UI thread from the row's travel.
 */
function IconMarqueeSlot({ source, slot, slots, progress, width, reverse }: IconMarqueeSlotProps) {
	const styles = useStyles();
	const placed = useAnimatedStyle(() => {
		const offset = slotOffset(slot, slots, progress.value);

		return { transform: [{ translateX: reverse ? width - SLOT_WIDTH - offset : offset }] };
	});

	return (
		<Animated.View style={[styles.slot, placed]}>
			<TintedIcon source={source} size={24} style={styles.icon} />
		</Animated.View>
	);
}

export default IconMarqueeSlot;
