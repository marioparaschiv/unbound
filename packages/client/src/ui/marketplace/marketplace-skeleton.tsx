import Animated, { FadeOut, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { View } from 'react-native';
import { useEffect } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';
import { Discord } from '~/metro/components';

import useStyles from './marketplace-skeleton.style';

type MarketplaceSkeletonProps = {
	/** How many placeholder cards to show. */
	count?: number;
};

/** Discord's shop skeleton pulse: 0.3 to full opacity and back, 650ms each way. */
const PULSE_FROM = 0.3;
const PULSE_DURATION = 650;

/**
 * @description Placeholder cards shaped like marketplace cards, pulsing while the catalog loads, in
 * place of a spinner. They fade out as the real cards fade in.
 */
function MarketplaceSkeleton({ count = 3 }: MarketplaceSkeletonProps) {
	const styles = useStyles();
	const reduced = useReducedMotion();
	const opacity = useSharedValue(reduced ? 1 : PULSE_FROM);
	const bars = [styles.titleBar, styles.subtitleBar, styles.descriptionBar, styles.lastBar];

	useEffect(() => {
		if (reduced) return;

		opacity.value = withRepeat(withTiming(1, { duration: PULSE_DURATION }), -1, true);
	}, [reduced]);

	return (
		<Animated.View style={[styles.list, { opacity }]} exiting={FadeOut}>
			{Array.from({ length: count }, (_, index) => (
				<Discord.Card
					key={index}
					variant='primary'
					border='subtle'
					shadow='low'
					style={styles.card}
				>
					<Discord.Stack direction='horizontal' spacing={12}>
						<View style={styles.icon} />
						<View style={styles.content}>
							{bars.map((bar, index) => (
								<View key={index} style={[styles.bar, bar]} />
							))}
						</View>
						<View style={styles.button} />
					</Discord.Stack>
				</Discord.Card>
			))}
		</Animated.View>
	);
}

export default MarketplaceSkeleton;
