import type { LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useRef, useState } from 'react';

import type { ScrollEdges, ScrollMetrics } from './scroll-edges';

import { scrollEdges } from './scroll-edges';

/**
 * @description Tracks which ends of a horizontal `ScrollView` have content scrolled out of view. Re-renders
 * only when an end flips, not on every scroll frame.
 * @returns The hidden ends, and the handlers to spread onto the `ScrollView`.
 */
function useScrollEdges() {
	const metrics = useRef<ScrollMetrics>({ offset: 0, width: 0, content: 0 });
	const [edges, setEdges] = useState<ScrollEdges>({ start: false, end: false });

	function update(patch: Partial<ScrollMetrics>) {
		metrics.current = { ...metrics.current, ...patch };

		const next = scrollEdges(metrics.current);

		setEdges((current) =>
			current.start === next.start && current.end === next.end ? current : next,
		);
	}

	return {
		edges,
		handlers: {
			scrollEventThrottle: 16,
			onLayout: (event: LayoutChangeEvent) =>
				update({ width: event.nativeEvent.layout.width }),
			onContentSizeChange: (content: number) => update({ content }),
			onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) =>
				update({ offset: event.nativeEvent.contentOffset.x }),
		},
	};
}

export default useScrollEdges;
