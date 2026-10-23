import { FadeInDown, FadeOutDown, LinearTransition, ReduceMotion } from 'react-native-reanimated';
import { useMemo } from 'react';

import { useReducedMotion } from '~/ui/hooks';

/** Shorter than Discord's 300ms default, so a leaving card is gone before survivors slide past it. */
const EXIT_DURATION = 150;

/**
 * @description The layout animations Discord gives cards in a list that filters live (its profile
 * wishlist grid): fade in and out downward, and spring the survivors into their new places.
 * @returns The `entering`, `exiting` and `layout` props for an `Animated.View` card.
 */
function useCardMotion() {
	const reduced = useReducedMotion();

	// Built in the hook: the reanimated shim resolves lazily, after this module loads.
	return useMemo(() => {
		const reduceMotion = reduced ? ReduceMotion.Always : ReduceMotion.Never;

		return {
			entering: FadeInDown.reduceMotion(reduceMotion),
			exiting: FadeOutDown.duration(EXIT_DURATION).reduceMotion(reduceMotion),
			layout: LinearTransition.springify()
				.mass(0.8)
				.damping(100)
				.stiffness(300)
				.reduceMotion(reduceMotion),
		};
	}, [reduced]);
}

export default useCardMotion;
