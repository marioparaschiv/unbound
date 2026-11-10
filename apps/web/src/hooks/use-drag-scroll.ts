import { SpringValue, easings, type SpringConfig } from '@react-spring/web';
import type { MouseEvent, PointerEvent } from 'react';
import { useEffect, useRef } from 'react';

type Sample = { position: number; time: number };

type DragState = {
	pointerId: number;
	startX: number;
	startPosition: number;
	/** The scroll range when the drag began; the overshoot shift would stretch a live reading. */
	max: number;
	/** Recent positions, for a release velocity that one jittery move cannot skew. */
	samples: Sample[];
	moved: boolean;
};

type DragScrollHandlers = {
	onPointerDown: (event: PointerEvent<HTMLElement>) => void;
	onPointerMove: (event: PointerEvent<HTMLElement>) => void;
	onPointerUp: (event: PointerEvent<HTMLElement>) => void;
	onPointerCancel: (event: PointerEvent<HTMLElement>) => void;
	onClickCapture: (event: MouseEvent<HTMLElement>) => void;
	onWheel: () => void;
	onTouchStart: () => void;
};

// Under this, a press stays a click on whatever it landed on.
const DRAG_THRESHOLD = 4;
// The release velocity averages the moves in this window, in ms.
const VELOCITY_WINDOW = 80;
// Per-ms deceleration that projects where a fling comes to rest; firmer than Apple's 0.998 so a flick
// carries a few hundred pixels, not whole screens.
const DECELERATION = 0.995;
// A release slower than this, in px per ms, stays exactly where the pointer let go.
const MIN_FLING_VELOCITY = 0.2;
// A fling travels at most this share of the row's visible width.
const MAX_FLING = 0.75;
// The coast's duration bounds, in ms.
const COAST_DURATION = { min: 220, max: 700 };
// How stiff a drag past either end feels; Apple's rubber-band constant.
const RUBBER_BAND = 0.55;
// Critically damped, so a release past an end settles back without a wobble.
const SETTLE: SpringConfig = { tension: 300, friction: 35 };

function prefersReducedMotion(): boolean {
	return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function clamp(value: number, max: number): number {
	return Math.min(Math.max(value, 0), max);
}

// Past an end the row follows the pointer less and less, up to one row width away.
function rubberBand(overshoot: number, width: number): number {
	return (1 - 1 / ((overshoot * RUBBER_BAND) / width + 1)) * width;
}

function withResistance(position: number, max: number, width: number): number {
	if (position < 0) {
		return -rubberBand(-position, width);
	}

	if (position > max) {
		return max + rubberBand(position - max, width);
	}

	return position;
}

// Speed over the last few moves, in px per ms; zero when the pointer rested before letting go.
function releaseVelocity(samples: Sample[], now: number): number {
	const recent = samples.filter((sample) => now - sample.time <= VELOCITY_WINDOW);
	const first = recent[0];
	const last = recent.at(-1);

	if (!first || !last || last.time === first.time) {
		return 0;
	}

	return (last.position - first.position) / (last.time - first.time);
}

// How far a fling carries: momentum projection, capped so a hard flick cannot skip past what was in view.
function flingDistance(velocity: number, width: number): number {
	if (Math.abs(velocity) < MIN_FLING_VELOCITY) {
		return 0;
	}

	const projected = (velocity * DECELERATION) / (1 - DECELERATION);
	const cap = width * MAX_FLING;

	return Math.min(Math.max(projected, -cap), cap);
}

// easeOutCubic starts at 3x its average speed, so this duration hands the release velocity over unchanged.
function coastDuration(distance: number, velocity: number): number {
	const duration = (3 * Math.abs(distance)) / Math.abs(velocity);

	return Math.min(Math.max(duration, COAST_DURATION.min), COAST_DURATION.max);
}

/**
 * @description Lets a mouse pan a horizontal scroller by dragging it. A slow release stays put, a fling eases
 * to a stop where its momentum carries it, and a drag past either end stretches and settles back. Touch, pens and trackpads
 * keep the browser's own scrolling.
 * @returns The handlers to spread on the scroller; it carries `data-dragging` while a drag runs.
 */
function useDragScroll(): DragScrollHandlers {
	const drag = useRef<DragState>(undefined);
	const dragged = useRef(false);
	const scroller = useRef<HTMLElement>(undefined);
	const range = useRef(0);
	const position = useRef<SpringValue<number>>(undefined);

	useEffect(
		() => () => {
			position.current?.stop();
		},
		[],
	);

	// Scroll covers the range. Past the start the row shifts right by the overshoot; past the end its
	// `drag-scroll-room` grows by it to scroll into, since shifting the row left would shrink the range too.
	function apply(value: number) {
		const element = scroller.current;

		if (!element) return;

		const overshoot = value - clamp(value, range.current);
		const content = element.firstElementChild as HTMLElement | null;

		content?.style.setProperty('translate', overshoot < 0 ? `${-overshoot}px 0` : '');
		content?.style.setProperty('--overscroll-end', overshoot > 0 ? `${overshoot}px` : '');
		element.scrollLeft = value - Math.min(overshoot, 0);
	}

	function spring(element: HTMLElement): SpringValue<number> {
		scroller.current = element;
		position.current ??= new SpringValue(element.scrollLeft, {
			onChange: ({ value }) => apply(value),
		});

		return position.current;
	}

	// Native scrolling takes over from a running coast, and lands the row back inside its range.
	function release() {
		const value = position.current;

		if (!value?.isAnimating) {
			return;
		}

		value.stop();
		apply(clamp(value.get(), range.current));
	}

	function onPointerDown(event: PointerEvent<HTMLElement>) {
		if (event.pointerType !== 'mouse' || event.button !== 0) return;

		const element = event.currentTarget;
		const value = spring(element);

		// A coast in flight is caught where it is; otherwise the row may have scrolled natively since.
		if (value.isAnimating) {
			value.stop();
		} else {
			range.current = element.scrollWidth - element.clientWidth;
			value.set(element.scrollLeft);
		}

		dragged.current = false;
		drag.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startPosition: value.get(),
			max: range.current,
			samples: [],
			moved: false,
		};
	}

	function onPointerMove(event: PointerEvent<HTMLElement>) {
		const state = drag.current;

		if (state?.pointerId !== event.pointerId) return;

		const element = event.currentTarget;
		const distance = event.clientX - state.startX;

		if (!state.moved) {
			if (Math.abs(distance) < DRAG_THRESHOLD) return;

			state.moved = true;
			element.setPointerCapture(event.pointerId);
			element.dataset.dragging = '';
			// A drag is not a press: `PressSprings` lets the thumbnail under the pointer spring back up.
			document.dispatchEvent(new PointerEvent('pointercancel'));
		}

		const next = withResistance(state.startPosition - distance, state.max, element.clientWidth);

		state.samples.push({ position: next, time: event.timeStamp });
		spring(element).set(next);
	}

	function onPointerUp(event: PointerEvent<HTMLElement>) {
		const state = drag.current;

		if (state?.pointerId !== event.pointerId) return;

		drag.current = undefined;

		if (!state.moved) return;

		const element = event.currentTarget;
		const value = spring(element);
		const current = value.get();
		const velocity = releaseVelocity(state.samples, event.timeStamp);
		const inRange = clamp(current, state.max) === current;
		const target = inRange
			? clamp(current + flingDistance(velocity, element.clientWidth), state.max)
			: clamp(current, state.max);

		delete element.dataset.dragging;
		dragged.current = true;

		if (target === current) return;

		// Released past an end: settle onto it. Otherwise ease out along the fling, with no overshoot.
		const config = inRange
			? { duration: coastDuration(target - current, velocity), easing: easings.easeOutCubic }
			: SETTLE;

		void value.start(target, { config, immediate: prefersReducedMotion() });
	}

	// A drag that ends on a thumbnail must not open it.
	function onClickCapture(event: MouseEvent<HTMLElement>) {
		if (!dragged.current) return;

		dragged.current = false;
		event.preventDefault();
		event.stopPropagation();
	}

	return {
		onPointerDown,
		onPointerMove,
		onPointerUp,
		onPointerCancel: onPointerUp,
		onClickCapture,
		onWheel: release,
		onTouchStart: release,
	};
}

export default useDragScroll;
