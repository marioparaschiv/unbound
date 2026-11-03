import { useRouter } from '@tanstack/react-router';
import { useEffect, type RefObject } from 'react';

/**
 * @description Keeps a sticky sidebar still across navigations, as docs sites do. The router scrolls the
 * window to the top after a link click, which drops a stuck sidebar back down by the page header's height,
 * and puts the sidebar's list back where it was in that history entry. This scrolls the window only back to
 * where the sidebar sticks and leaves the list where the reader had it, so only the page beside them changes.
 * Back and forward keep the router's window restoration; hash links keep its jump to the anchor.
 * @param sidebar The sticky sidebar; its window handling is skipped while it is hidden.
 * @param list The sidebar's scrolling list.
 */
function useSteadySidebar(
	sidebar: RefObject<HTMLElement | null>,
	list: RefObject<HTMLElement | null>,
): void {
	const router = useRouter();

	useEffect(() => {
		let pushedFrom: number | undefined;
		let listTop: number | undefined;

		const unsubscribeHistory = router.history.subscribe(({ action }) => {
			pushedFrom = action.type === 'PUSH' ? window.scrollY : undefined;
			listTop = list.current?.scrollTop;
		});

		// Runs after the router's own `onRendered` restoration, before the frame paints.
		const unsubscribeRendered = router.subscribe('onRendered', ({ toLocation }) => {
			const from = pushedFrom;
			const element = sidebar.current;

			if (list.current && listTop !== undefined) {
				list.current.scrollTop = listTop;
			}

			pushedFrom = undefined;
			listTop = undefined;

			if (from === undefined || toLocation.hash || !element?.offsetParent) return;

			const stickyTop = Number.parseFloat(getComputedStyle(element).top) || 0;
			const column = element.parentElement ?? element;
			const stuckAt = column.getBoundingClientRect().top + window.scrollY - stickyTop;

			window.scrollTo({ top: Math.min(from, Math.max(stuckAt, 0)) });
		});

		return () => {
			unsubscribeHistory();
			unsubscribeRendered();
		};
	}, [router, sidebar, list]);
}

export default useSteadySidebar;
