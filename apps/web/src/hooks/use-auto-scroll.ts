import type { RefObject } from 'react';
import { useEffect } from 'react';

type AutoScrollOptions = {
	/** Drift speed in pixels per second. */
	speed?: number;
	/** How long it rests at each end, in milliseconds. */
	pause?: number;
	/** How long it waits after the user scrolls or taps before drifting again, in milliseconds. */
	idle?: number;
};

/**
 * @description Drifts a horizontal scroller slowly to its end and back, resting at each end. Holds while
 * hovered or focused, waits after the user scrolls it, and stays still under reduced motion.
 * @param ref The scroller.
 * @param options The drift speed, the rest at each end and the wait after user input.
 */
function useAutoScroll(
	ref: RefObject<HTMLElement | null>,
	{ speed = 24, pause = 2500, idle = 4000 }: AutoScrollOptions = {},
): void {
	useEffect(() => {
		const element = ref.current;

		if (!element) return;

		const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
		let hovered = false;
		let focused = false;
		let direction = 1;
		let restUntil = performance.now() + pause;
		let last = performance.now();
		// Kept as a float, since `scrollLeft` rounds and sub-pixel steps would never add up.
		let position = element.scrollLeft;
		let frame = 0;
		// Narrowed once here, since the function declarations below are hoisted past the guard.
		const scroller = element;

		function tick(now: number) {
			frame = requestAnimationFrame(tick);

			const max = scroller.scrollWidth - scroller.clientWidth;
			const elapsed = now - last;

			last = now;

			// Picks up from wherever the user left it.
			if (max <= 0 || reducedMotion.matches || hovered || focused || now < restUntil) {
				position = scroller.scrollLeft;

				return;
			}

			position = Math.min(Math.max(position + (direction * speed * elapsed) / 1000, 0), max);
			scroller.scrollLeft = position;

			if (!((direction > 0 && position >= max) || (direction < 0 && position <= 0))) {
				return;
			}

			direction = -direction;
			restUntil = now + pause;
		}

		frame = requestAnimationFrame(tick);

		function onPointerEnter(event: PointerEvent) {
			if (event.pointerType === 'mouse') {
				hovered = true;
			}
		}

		function onPointerLeave(event: PointerEvent) {
			if (event.pointerType !== 'mouse') return;

			hovered = false;
			restUntil = performance.now() + pause;
		}

		function onInput() {
			restUntil = performance.now() + idle;
		}

		function onFocusIn() {
			focused = true;
		}

		function onFocusOut() {
			focused = false;
			restUntil = performance.now() + pause;
		}

		element.addEventListener('pointerenter', onPointerEnter);
		element.addEventListener('pointerleave', onPointerLeave);
		element.addEventListener('pointerdown', onInput);
		element.addEventListener('touchmove', onInput, { passive: true });
		element.addEventListener('wheel', onInput, { passive: true });
		element.addEventListener('focusin', onFocusIn);
		element.addEventListener('focusout', onFocusOut);

		return () => {
			cancelAnimationFrame(frame);
			element.removeEventListener('pointerenter', onPointerEnter);
			element.removeEventListener('pointerleave', onPointerLeave);
			element.removeEventListener('pointerdown', onInput);
			element.removeEventListener('touchmove', onInput);
			element.removeEventListener('wheel', onInput);
			element.removeEventListener('focusin', onFocusIn);
			element.removeEventListener('focusout', onFocusOut);
		};
	}, [ref, speed, pause, idle]);
}

export default useAutoScroll;
