import {
	Easing,
	Extrapolation,
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';

import { nextPresence, settlePresence, type Presence } from './settings-button-presence';

/** The button's own width plus the row gap: the slot it opens, and how far it sits under the overflow button. */
const TUCKED_OFFSET = 40;
/** How far out the button slides before it starts to grow from nothing, so it emerges from under the overflow button. */
const EMERGE_AT = 0.3;
/** A full slide in or out; a reversal mid-move takes only the share of it left to travel. */
const SLIDE_MS = 280;
/** Decelerates into its slot so it lands without overshoot; the exit accelerates back under. */
const ENTER_EASING = Easing.out(Easing.cubic);
const EXIT_EASING = Easing.in(Easing.cubic);
/** Reduced motion's plain cross-fade. */
const FADE_MS = 150;

/**
 * @description Animates the card's settings button out from under the overflow button and back, on the UI thread.
 * It opens its slot as it slides, so nothing beside it jumps, and grows from nothing once partly out. A flip mid-move
 * reverses from where the button is, over the distance left. It stays mounted until its exit finishes. Reduced
 * motion cross-fades only.
 * @param visible Whether the button should show.
 * @returns Whether to render the button, and its animated style.
 */
function useSettingsButtonMotion(visible: boolean) {
	const reduced = useReducedMotion();
	const [presence, setPresence] = useState<Presence>({ mounted: visible, shown: visible });
	const progress = useSharedValue(visible ? 1 : 0);

	function settle() {
		setPresence(settlePresence);
	}

	useEffect(() => {
		setPresence((current) => nextPresence(current, visible));

		const target = visible ? 1 : 0;
		const remaining = Math.abs(target - progress.value);

		// Inline, so the worklets transform turns the callback into a UI-thread worklet. `finished` is false when a
		// flip interrupted the move, so an interrupted exit keeps the button mounted.
		progress.value = withTiming(
			target,
			reduced
				? { duration: FADE_MS }
				: {
						duration: Math.round(SLIDE_MS * remaining),
						easing: visible ? ENTER_EASING : EXIT_EASING,
					},
			(finished) => {
				if (finished && target === 0) {
					runOnJS(settle)();
				}
			},
		);
	}, [visible, reduced]);

	const style = useAnimatedStyle(() => {
		if (reduced) {
			return { opacity: progress.value, marginRight: 0, transform: [] };
		}

		return {
			marginRight: -TUCKED_OFFSET * (1 - progress.value),
			transform: [
				{
					scale: interpolate(progress.value, [EMERGE_AT, 1], [0, 1], Extrapolation.CLAMP),
				},
			],
		};
	});

	return { mounted: presence.mounted, style };
}

export default useSettingsButtonMotion;
