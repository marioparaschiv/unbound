import Animated from 'react-native-reanimated';

import { icons } from '~/assets/api';

import type { BadgeLayer } from './use-badge-layers';

import useBadgeMotion from './use-badge-motion';
import useStyles from './hero-badge.style';
import BlurredIcon from './blurred-icon';

/** @description One look of the hero badge, popping in when it arrives and out when the next replaces it. */
function HeroBadgeLayer({ tone, icon, spinning, entering, leaving }: BadgeLayer) {
	const styles = useStyles();
	const motion = useBadgeMotion({ entering, leaving, spinning });

	return (
		<Animated.View style={[styles.layer, styles[`${tone}Badge`], motion.layer]}>
			<Animated.View style={[styles.icon, motion.icon]}>
				<BlurredIcon
					source={icons[icon] ?? 0}
					amount={motion.blur}
					style={styles[`${tone}Icon`]}
				/>
			</Animated.View>
		</Animated.View>
	);
}

export default HeroBadgeLayer;
