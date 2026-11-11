import {
	cancelAnimation,
	Easing,
	runOnJS,
	useAnimatedReaction,
	useSharedValue,
	withRepeat,
	withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';

/**
 * @description Scrolls a marquee row forever at a steady pace, on the UI thread, and reports each whole slot it
 * passes so the row can swap the icon in the slot that just left. Reduced motion holds it still.
 * @param loop The slot widths after which the row looks as it started: a multiple of its slot and icon counts.
 * @param msPerSlot How long the row takes to travel one slot width.
 * @returns The row's travel in slot widths, and the whole slots passed.
 */
function useMarqueeProgress(loop: number, msPerSlot: number) {
	const reduced = useReducedMotion();
	const progress = useSharedValue(0);
	const [step, setStep] = useState(0);

	useEffect(() => {
		progress.value = 0;

		if (!reduced && loop > 0) {
			progress.value = withRepeat(
				withTiming(loop, { duration: loop * msPerSlot, easing: Easing.linear }),
				-1,
			);
		}

		return () => cancelAnimation(progress);
	}, [loop, msPerSlot, reduced]);

	useAnimatedReaction(
		() => Math.floor(progress.value),
		(current, previous) => {
			if (current !== previous) {
				runOnJS(setStep)(current);
			}
		},
	);

	return { progress, step };
}

export default useMarqueeProgress;
