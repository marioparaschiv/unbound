import {
	Easing,
	cancelAnimation,
	interpolate,
	useAnimatedProps,
	useAnimatedStyle,
	useSharedValue,
	withRepeat,
	withSpring,
	withTiming,
} from 'react-native-reanimated';
import { useEffect } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';

/** Short enough that the next badge is already landing as this one leaves. */
const EXIT_MS = 240;
/** One turn of the checking icon. */
const SPIN_MS = 900;
/** Underdamped, so the new badge overshoots and settles: the pop. */
const POP_SPRING = { damping: 11, stiffness: 260, mass: 0.7 };
/** The blur a badge enters from and leaves to, in points. */
const BLUR = 8;

type BadgeMotionOptions = {
	entering: boolean;
	leaving: boolean;
	spinning: boolean;
};

/**
 * @description Animates one hero badge layer: it springs in from small and blurred, pops out by growing,
 * blurring and fading, and spins while checking. Reduced motion swaps and holds still.
 * @param options Whether the layer is arriving, leaving or spinning.
 * @returns The layer's and icon's animated styles, and the icon's animated blur.
 */
function useBadgeMotion({ entering, leaving, spinning }: BadgeMotionOptions) {
	const reduced = useReducedMotion();
	const enter = useSharedValue(entering && !reduced ? 0 : 1);
	const exit = useSharedValue(0);
	const turn = useSharedValue(0);

	useEffect(() => {
		if (entering && !reduced) {
			enter.value = withSpring(1, POP_SPRING);
		}
	}, []);

	useEffect(() => {
		if (leaving) {
			exit.value = withTiming(1, {
				duration: reduced ? 0 : EXIT_MS,
				easing: Easing.out(Easing.quad),
			});
		}
	}, [leaving]);

	useEffect(() => {
		if (!spinning || reduced) {
			cancelAnimation(turn);
			turn.value = 0;

			return;
		}

		turn.value = withRepeat(withTiming(360, { duration: SPIN_MS, easing: Easing.linear }), -1);
	}, [spinning, reduced]);

	const layer = useAnimatedStyle(() => ({
		opacity: Math.min(enter.value, 1) * (1 - exit.value),
		transform: [
			{
				scale:
					interpolate(enter.value, [0, 1], [0.4, 1]) *
					interpolate(exit.value, [0, 1], [1, 1.35]),
			},
		],
	}));
	const icon = useAnimatedStyle(() => ({
		transform: [{ rotate: `${turn.value}deg` }],
	}));
	const blur = useAnimatedProps(() => ({
		blurRadius: Math.round(Math.max(1 - Math.min(enter.value, 1), exit.value) * BLUR),
	}));

	return { layer, icon, blur };
}

export default useBadgeMotion;
