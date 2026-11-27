import type { SegmentedControlState } from '@unbound-app/types/components';
import { useEffect } from 'react';

/** Presses while the screen slides in, where the pressed tab's brief highlight goes unseen. */
const DELAY = 0;

/**
 * @description Mounts every page of a `SegmentedControlPages` shortly after it opens. Discord's pager mounts only
 * the pages between the active tab and a pressed one, so pressing the first and last tabs for a frame each covers all.
 * @param state The `useSegmentedControlState` result.
 * @param count How many pages it holds.
 */
function usePrefetchPages(state: SegmentedControlState, count: number) {
	useEffect(() => {
		const steps = [0, count - 1, -1];
		let frame = 0;

		function step() {
			const index = steps.shift();

			if (index === undefined) return;

			state.pressedIndex?.set(index);
			frame = requestAnimationFrame(step);
		}

		const timer = setTimeout(step, DELAY);

		return () => {
			clearTimeout(timer);
			cancelAnimationFrame(frame);
		};
	}, []);
}

export default usePrefetchPages;
