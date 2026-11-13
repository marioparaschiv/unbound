import {
	Easing,
	runOnJS,
	useAnimatedStyle,
	useSharedValue,
	withTiming,
} from 'react-native-reanimated';
import type { LayoutChangeEvent } from 'react-native';
import { useEffect, useState } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';

/** Long enough to follow the rows opening, short enough to stay out of the way. */
const DURATION_MS = 260;

function timing(reduced: boolean) {
	return {
		duration: reduced ? 0 : DURATION_MS,
		// A strong ease-out: the rows move at once and settle softly. Built per move, not at import: touching `Easing`
		// loads Reanimated, which startup should not wait on.
		easing: Easing.bezier(0.23, 1, 0.32, 1),
	};
}

/**
 * @description Animates a collapsible group on the UI thread: its body's height between 0 and the rows' measured
 * height, and its chevron turning over. Closed rows unmount once the body has shut, and reopened ones open only after
 * they are measured, so the move runs from its first frame. The chevron turns at once. Reduced motion snaps.
 * @param expanded Whether the rows should show.
 * @returns Whether to render the rows, the body's and chevron's animated styles, and the rows' layout handler.
 */
function useCollapseMotion(expanded: boolean) {
	const reduced = useReducedMotion();
	const [mounted, setMounted] = useState(expanded);
	// The rows' laid-out height; `undefined` while they are unmounted or not yet laid out.
	const [height, setHeight] = useState<number | undefined>(undefined);
	const progress = useSharedValue(expanded ? 1 : 0);
	const turn = useSharedValue(expanded ? 1 : 0);
	const measured = height !== undefined;

	function unmount() {
		setMounted(false);
		setHeight(undefined);
	}

	useEffect(() => {
		turn.value = withTiming(expanded ? 1 : 0, timing(reduced));

		if (expanded) {
			setMounted(true);

			return;
		}

		// Inline, so the worklets transform turns the callback into a UI-thread worklet. `finished` is false when a
		// reopen interrupted the close, so the rows stay mounted.
		progress.value = withTiming(0, timing(reduced), (finished) => {
			if (finished) {
				runOnJS(unmount)();
			}
		});
	}, [expanded, reduced]);

	useEffect(() => {
		if (expanded && measured) {
			progress.value = withTiming(1, timing(reduced));
		}
	}, [expanded, measured, reduced]);

	const body = useAnimatedStyle(() => ({ height: progress.value * (height ?? 0) }), [height]);
	const chevron = useAnimatedStyle(() => ({
		transform: [{ rotate: `${turn.value * 180}deg` }],
	}));

	function measure(event: LayoutChangeEvent) {
		setHeight(event.nativeEvent.layout.height);
	}

	return { mounted, body, chevron, measure };
}

export default useCollapseMotion;
