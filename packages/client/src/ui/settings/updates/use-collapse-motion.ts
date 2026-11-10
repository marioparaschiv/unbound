import { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import type { LayoutChangeEvent } from 'react-native';
import { useEffect, useState } from 'react';

import useReducedMotion from '~/ui/hooks/use-reduced-motion';

/** Long enough to follow the rows opening, short enough to stay out of the way. */
const DURATION_MS = 260;

/**
 * @description Animates a collapsible group on the UI thread: its body's height between 0 and the rows'
 * measured height, and its chevron turning over. The rows stay opaque so the card's shape follows the height.
 * Reduced motion snaps.
 * @param expanded Whether the rows should show.
 * @returns The body's and chevron's animated styles, and the layout handler that measures the rows.
 */
function useCollapseMotion(expanded: boolean) {
	const reduced = useReducedMotion();
	const [height, setHeight] = useState(0);
	const progress = useSharedValue(expanded ? 1 : 0);

	useEffect(() => {
		progress.value = withTiming(expanded ? 1 : 0, {
			duration: reduced ? 0 : DURATION_MS,
			// A strong ease-out: the rows move at once and settle softly. Built per move, not at import: touching `Easing`
			// loads Reanimated, which startup should not wait on.
			easing: Easing.bezier(0.23, 1, 0.32, 1),
		});
	}, [expanded, reduced]);

	const body = useAnimatedStyle(() => ({ height: progress.value * height }), [height]);
	const chevron = useAnimatedStyle(() => ({
		transform: [{ rotate: `${progress.value * 180}deg` }],
	}));

	function measure(event: LayoutChangeEvent) {
		setHeight(event.nativeEvent.layout.height);
	}

	return { body, chevron, measure };
}

export default useCollapseMotion;
