import { Animated, Dimensions, Easing } from 'react-native';
import { useEffect, useState } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';

/** How far past each edge the shine starts and ends, so it enters and leaves fully hidden. */
const SHINE_OVERSHOOT = 160;

function float(value: Animated.Value, toValue: number) {
	return Animated.timing(value, {
		toValue,
		duration: 2400,
		easing: Easing.inOut(Easing.sin),
		useNativeDriver: true,
	});
}

/**
 * @description The General banner's motion: the logo floats and a shine sweeps across every few
 * seconds. Both stop, and the shine hides, when Discord's reduced motion is on.
 * @returns The logo's and the shine's animated styles.
 */
function useBannerMotion() {
	const reduced = useReducedMotion();
	const [lift] = useState(() => new Animated.Value(0));
	const [sweep] = useState(() => new Animated.Value(0));

	useEffect(() => {
		if (reduced) return;

		const loops = [
			Animated.loop(Animated.sequence([float(lift, 1), float(lift, 0)])),
			Animated.loop(
				Animated.sequence([
					Animated.delay(4200),
					Animated.timing(sweep, {
						toValue: 1,
						duration: 1800,
						easing: Easing.inOut(Easing.cubic),
						useNativeDriver: true,
					}),
					Animated.timing(sweep, { toValue: 0, duration: 0, useNativeDriver: true }),
				]),
			),
		];

		for (const loop of loops) loop.start();

		return () => {
			for (const loop of loops) loop.stop();
		};
	}, [reduced]);

	return {
		logo: {
			transform: [
				{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) },
			],
		},
		shine: {
			opacity: reduced ? 0 : 1,
			transform: [
				{
					translateX: sweep.interpolate({
						inputRange: [0, 1],
						// The window bounds the banner, so the sweep always clears its right edge.
						outputRange: [
							-SHINE_OVERSHOOT,
							Dimensions.get('window').width + SHINE_OVERSHOOT,
						],
					}),
				},
				{ rotate: '20deg' },
			],
		},
	};
}

export default useBannerMotion;
