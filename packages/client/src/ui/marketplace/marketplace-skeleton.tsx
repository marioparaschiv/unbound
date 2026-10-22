import Animated, { FadeOut, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { View } from 'react-native';
import { useEffect } from 'react';

import { Discord } from '~/api/metro/components';
import { useReducedMotion } from '~/ui/hooks';

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

	useEffect(() => {
		if (reduced) return;

		opacity.value = withRepeat(withTiming(1, { duration: PULSE_DURATION }), -1, true);
	}, [reduced]);

	return (
		<Animated.View style={{ gap: 12, opacity }} exiting={FadeOut}>
			{Array.from({ length: count }, (_, index) => (
				<Discord.Card
					key={index}
					variant='primary'
					border='subtle'
					shadow='low'
					style={styles.card}
				>
					<View style={styles.header}>
						<View style={styles.icon} />
						<View style={styles.content}>
							<View style={[styles.bar, { width: '45%', height: 16 }]} />
							<View style={[styles.bar, { width: '25%', height: 12 }]} />
							<View
								style={[styles.bar, { width: '92%', height: 14, marginTop: 6 }]}
							/>
							<View style={[styles.bar, { width: '64%', height: 14 }]} />
						</View>
						<View style={styles.button} />
					</View>
				</Discord.Card>
			))}
		</Animated.View>
	);
}

export default MarketplaceSkeleton;
