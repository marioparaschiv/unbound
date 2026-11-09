import Animated, { useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Dimensions, View } from 'react-native';
import { useEffect } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';
import { Discord } from '~/metro/components';

import useStyles from './marketplace-skeleton.style';

/** A placeholder card's height plus the gap below it, rounded down so the cards always overrun the screen. */
const CARD_PITCH = 150;

/** A subtle pulse: 0.6 to full opacity and back, 1s each way, gentler than Discord's 0.3 over 650ms. */
const PULSE_FROM = 0.6;
const PULSE_DURATION = 1000;

/**
 * @description Pulsing placeholder cards laid out like marketplace cards: icon, name, authors and button
 * on one centred row, a two-line description below, then the tags and version. Shown while the catalog loads,
 * filling the tab as a full page of cards would; the last card is clipped at the bottom edge.
 */
function MarketplaceSkeleton() {
	const styles = useStyles();
	const count = Math.ceil(Dimensions.get('window').height / CARD_PITCH);
	const reduced = useReducedMotion();
	const opacity = useSharedValue(reduced ? 1 : PULSE_FROM);

	useEffect(() => {
		if (reduced) return;

		opacity.value = withRepeat(withTiming(1, { duration: PULSE_DURATION }), -1, true);
	}, [reduced]);

	return (
		<Animated.View style={[styles.list, { opacity }]}>
			{Array.from({ length: count }, (_, index) => (
				<Discord.Card
					key={index}
					variant='primary'
					border='subtle'
					shadow='low'
					style={styles.card}
				>
					<Discord.Stack direction='horizontal' spacing={12} align='center'>
						<View style={styles.icon} />
						<View style={styles.heading}>
							<View style={[styles.bar, styles.titleBar]} />
							<View style={[styles.bar, styles.authorsBar]} />
						</View>
						<View style={styles.button} />
					</Discord.Stack>
					<View style={styles.description}>
						<View style={[styles.bar, styles.lineBar]} />
						<View style={[styles.bar, styles.lastLineBar]} />
					</View>
					<View style={styles.footer}>
						<View style={[styles.pill, styles.tagPill]} />
						<View style={[styles.pill, styles.tagPill]} />
						<View style={styles.spacer} />
						<View style={[styles.pill, styles.versionPill]} />
					</View>
				</Discord.Card>
			))}
		</Animated.View>
	);
}

export default MarketplaceSkeleton;
