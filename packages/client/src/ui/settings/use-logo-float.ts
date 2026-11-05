import { Animated, Easing } from 'react-native';
import { useEffect, useState } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';

function float(value: Animated.Value, toValue: number) {
	return Animated.timing(value, {
		toValue,
		duration: 2400,
		easing: Easing.inOut(Easing.sin),
		useNativeDriver: true,
	});
}

/**
 * @description Floats the Unbound page's logo gently up and down. It holds still when Discord's reduced motion is on.
 * @returns The logo's animated style.
 */
function useLogoFloat() {
	const reduced = useReducedMotion();
	const [lift] = useState(() => new Animated.Value(0));

	useEffect(() => {
		if (reduced) return;

		const loop = Animated.loop(Animated.sequence([float(lift, 1), float(lift, 0)]));

		loop.start();

		return () => loop.stop();
	}, [reduced]);

	return {
		transform: [{ translateY: lift.interpolate({ inputRange: [0, 1], outputRange: [3, -3] }) }],
	};
}

export default useLogoFloat;
