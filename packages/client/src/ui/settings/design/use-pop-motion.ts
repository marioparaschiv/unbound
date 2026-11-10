import {
	Easing,
	Extrapolation,
	interpolate,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withDelay,
	withTiming,
} from 'react-native-reanimated';
import { useEffect, useState } from 'react';

import { nextPresence, settlePresence, type Presence } from '~/ui/addons/settings-button-presence';
import useReducedMotion from '~/ui/hooks/use-reduced-motion';

type Bezier = readonly [x1: number, y1: number, x2: number, y2: number];

/** A full scale in or out; a reversal takes only the share left. */
const POP_MS = 220;
/**
 * Expo-out as a curve: fast then settling. `Easing.exp` itself reaches half size in the first frame and then
 * crawls, which reads as two separate entries.
 */
const ENTER_BEZIER: Bezier = [0.16, 1, 0.3, 1];
const EXIT_BEZIER: Bezier = [0.7, 0, 0.84, 0];
/** The share of the move over which it fades in, so it never shows as a hard-edged speck. */
const FADE_SHARE = 0.5;
/** How long a freshly mounted button waits before popping in. */
const MOUNT_DELAY_MS = 120;
/** Reduced motion's plain cross-fade. */
const FADE_MS = 150;

/**
 * @description Scales a floating button in from nothing as it fades up, on the UI thread, and back out the same way.
 * It mounts from nothing, stays mounted until its exit finishes, and reverses mid-move from where it is, as the card's
 * settings button does. Reduced motion cross-fades only.
 * @param visible Whether the button should show.
 * @returns Whether to render the button, and its animated style.
 */
function usePopMotion(visible: boolean) {
	const reduced = useReducedMotion();
	const [presence, setPresence] = useState<Presence>({ mounted: visible, shown: visible });
	const progress = useSharedValue(0);

	function settle() {
		setPresence(settlePresence);
	}

	useEffect(() => {
		setPresence((current) => nextPresence(current, visible));

		const target = visible ? 1 : 0;
		const remaining = Math.abs(target - progress.value);

		// Inline, so the worklets transform turns the callback into a UI-thread worklet.
		const move = withTiming(
			target,
			reduced
				? { duration: FADE_MS }
				: {
						duration: Math.round(POP_MS * remaining),
						// Built per move, not at import: touching `Easing` loads Reanimated, which startup should not wait on.
						easing: Easing.bezier(...(visible ? ENTER_BEZIER : EXIT_BEZIER)),
					},
			(finished) => {
				if (finished && target === 0) {
					runOnJS(settle)();
				}
			},
		);

		// The first entry waits out the page's mount, whose long frames otherwise skip it ahead in jumps.
		progress.value = progress.value === 0 && visible ? withDelay(MOUNT_DELAY_MS, move) : move;
	}, [visible, reduced]);

	const style = useAnimatedStyle(() =>
		reduced
			? { opacity: progress.value, transform: [] }
			: {
					opacity: interpolate(
						progress.value,
						[0, FADE_SHARE],
						[0, 1],
						Extrapolation.CLAMP,
					),
					transform: [{ scale: progress.value }],
				},
	);

	return { mounted: presence.mounted, style };
}

export default usePopMotion;
