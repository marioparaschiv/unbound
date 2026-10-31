import { useCallback, useEffect, useRef } from 'react';
import type { UIEvent } from 'react';

// Silence this long after the last scroll event ends a scroll.
const SCROLL_IDLE_MS = 150;

const SHIELD = '[data-slot=icon-picker-scroll-shield]';

/**
 * @description Shows the viewport's scroll shield while it scrolls, so the pointer stops hit-testing
 * the grid: otherwise every cell sliding under a resting pointer turns active and re-renders.
 * @returns The scroll handler to put on the viewport.
 */
function useScrollShield(): (event: UIEvent<HTMLDivElement>) => void {
	const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => () => clearTimeout(idle.current), []);

	return useCallback((event: UIEvent<HTMLDivElement>) => {
		const shield = event.currentTarget.querySelector<HTMLElement>(SHIELD);

		if (!shield) return;

		shield.hidden = false;
		clearTimeout(idle.current);
		idle.current = setTimeout(() => {
			shield.hidden = true;
		}, SCROLL_IDLE_MS);
	}, []);
}

export default useScrollShield;
