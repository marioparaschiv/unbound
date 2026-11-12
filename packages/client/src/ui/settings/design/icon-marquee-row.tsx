import type { ImageURISource } from 'react-native';
import { View } from 'react-native';

import useMarqueeProgress from './use-marquee-progress';
import { iconIndex, slotsFor } from './marquee-slots';
import IconMarqueeSlot from './icon-marquee-slot';
import useStyles from './icon-marquee-row.style';

type IconMarqueeRowProps = {
	icons: ImageURISource[];
	width: number;
	reverse: boolean;
	msPerSlot: number;
};

/** How many times a row's slots cycle before it starts over: weeks of scrolling, so in practice it never wraps. */
const CYCLES = 100_000;

/**
 * @description One row of the icon marquee: its icons scroll past in turn, forever, through a fixed set of slots, so a
 * pack of hundreds of icons keeps only a screenful mounted.
 */
function IconMarqueeRow({ icons, width, reverse, msPerSlot }: IconMarqueeRowProps) {
	const styles = useStyles();
	const slots = slotsFor(width);
	// Independent of the icons, so another pack's icons swap into the moving slots instead of restarting the row.
	const { progress, step } = useMarqueeProgress(slots * CYCLES, msPerSlot);

	return (
		<View style={styles.row}>
			{Array.from({ length: slots }, (_, slot) => (
				<IconMarqueeSlot
					key={slot}
					source={icons[iconIndex(slot, slots, step, icons.length)]}
					slot={slot}
					slots={slots}
					progress={progress}
					width={width}
					reverse={reverse}
				/>
			))}
		</View>
	);
}

export default IconMarqueeRow;
