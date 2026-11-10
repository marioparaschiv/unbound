import Animated, {
	Easing,
	cancelAnimation,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';
import TintedIcon from '~/metro/fallbacks/tinted-icon';
import { icons } from '~/assets/api';

/** One turn, matching the hero badge's checking spin. */
const SPIN_MS = 900;

/** @description A row's trailing mark while the update check covering it runs: the hero's arrow, spinning. */
function CheckingIcon() {
	const reduced = useReducedMotion();
	const turn = useSharedValue(0);

	useEffect(() => {
		if (reduced) {
			cancelAnimation(turn);
			turn.value = 0;

			return;
		}

		turn.value = withRepeat(withTiming(360, { duration: SPIN_MS, easing: Easing.linear }), -1);

		return () => cancelAnimation(turn);
	}, [reduced]);

	const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));

	return (
		<Animated.View style={spin}>
			<TintedIcon source={icons.RetryIcon ?? 0} size={20} />
		</Animated.View>
	);
}

export default CheckingIcon;
