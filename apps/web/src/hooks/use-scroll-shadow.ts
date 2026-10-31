import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject, UIEvent } from 'react';

type ScrollAxis = 'x' | 'y';

type ScrollShadowState = {
	ref: RefObject<HTMLDivElement | null>;
	/** There is content before the scroll position, so the start shadow shows. */
	canScrollStart: boolean;
	/** There is content after the scroll position, so the end shadow shows. */
	canScrollEnd: boolean;
	onScroll: (event: UIEvent<HTMLDivElement>) => void;
};

/**
 * @description Tracks whether a scroller has content past either edge, through scrolling, resizes
 * and children being added or removed. Ported from Telecord's hook.
 * @param axis The axis the element scrolls on.
 * @returns The ref and scroll handler to put on the scroller, and which edges can scroll.
 */
function useScrollShadow(axis: ScrollAxis = 'y'): ScrollShadowState {
	const ref = useRef<HTMLDivElement | null>(null);
	const [canScrollStart, setCanScrollStart] = useState(false);
	const [canScrollEnd, setCanScrollEnd] = useState(false);

	const update = useCallback(
		(element: HTMLElement) => {
			if (axis === 'x') {
				setCanScrollStart(element.scrollLeft > 0);
				setCanScrollEnd(element.scrollLeft + element.clientWidth < element.scrollWidth - 1);

				return;
			}

			setCanScrollStart(element.scrollTop > 0);
			setCanScrollEnd(element.scrollTop + element.clientHeight < element.scrollHeight - 1);
		},
		[axis],
	);

	const onScroll = useCallback(
		(event: UIEvent<HTMLDivElement>) => update(event.currentTarget),
		[update],
	);

	useEffect(() => {
		const element = ref.current;

		if (!element) return;

		// Children resizing changes the scroll height without resizing the scroller itself.
		function observeAll(target: HTMLElement, observer: ResizeObserver) {
			observer.observe(target);

			for (const child of target.children) {
				observer.observe(child);
			}
		}

		const resize = new ResizeObserver(() => update(element));
		const mutation = new MutationObserver(() => {
			resize.disconnect();
			observeAll(element, resize);
			update(element);
		});

		update(element);
		observeAll(element, resize);
		mutation.observe(element, { childList: true });

		return () => {
			resize.disconnect();
			mutation.disconnect();
		};
	}, [update]);

	return { ref, canScrollStart, canScrollEnd, onScroll };
}

export default useScrollShadow;
