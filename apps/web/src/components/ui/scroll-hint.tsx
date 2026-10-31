import { IconChevronDown, IconChevronUp } from 'nucleo-micro-bold';
import type { ComponentProps, MouseEvent, ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';

import cn from '~/lib/cn';

type ScrollDirection = 'up' | 'down';

type ScrollHintProps = ComponentProps<'div'> & {
	maxHeight?: string;
};

type ScrollHintArrowProps = {
	direction: ScrollDirection;
	onStart: (direction: ScrollDirection) => void;
	onStop: () => void;
};

const SCROLL_STEP = 6;
const SCROLL_INTERVAL_MS = 16;

const FADE_IN = { opacity: 1 };
const FADE_OUT = { opacity: 0 };
const FADE_TRANSITION = { duration: 0.15 };

const ARROW_STYLES: Record<ScrollDirection, string> = {
	up: 'top-0 bg-linear-to-b',
	down: 'bottom-0 bg-linear-to-t',
};

const ARROW_ICONS: Record<ScrollDirection, ReactNode> = {
	up: <IconChevronUp className='size-4 text-foreground' />,
	down: <IconChevronDown className='size-4 text-foreground' />,
};

function isAtBoundary(element: HTMLElement, direction: ScrollDirection) {
	if (direction === 'up') {
		return element.scrollTop <= 0;
	}

	return element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
}

function ScrollHintArrow({ direction, onStart, onStop }: ScrollHintArrowProps) {
	function start(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		onStart(direction);
	}

	function stop(event: MouseEvent<HTMLButtonElement>) {
		event.preventDefault();
		onStop();
	}

	return (
		<motion.div
			initial={FADE_OUT}
			animate={FADE_IN}
			exit={FADE_OUT}
			transition={FADE_TRANSITION}
			className={cn(
				'absolute inset-x-0 flex justify-center items-center from-popover via-popover/80 to-transparent h-6 pointer-events-none',
				ARROW_STYLES[direction],
			)}
		>
			<button
				type='button'
				className='pointer-events-auto cursor-pointer p-1'
				onMouseDown={start}
				onMouseUp={stop}
				onMouseLeave={onStop}
			>
				{ARROW_ICONS[direction]}
			</button>
		</motion.div>
	);
}

function ScrollHint({ maxHeight = 'max-h-48', className, children, ...props }: ScrollHintProps) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const intervalRef = useRef<ReturnType<typeof setInterval>>(null);
	const isScrollingRef = useRef(false);
	const [canScrollUp, setCanScrollUp] = useState(false);
	const [canScrollDown, setCanScrollDown] = useState(false);
	const [isHovered, setIsHovered] = useState(false);

	const updateScrollState = useCallback(() => {
		const element = scrollRef.current;

		if (!element) return;

		setCanScrollUp(!isAtBoundary(element, 'up'));
		setCanScrollDown(!isAtBoundary(element, 'down'));
	}, []);

	const stopScrolling = useCallback(() => {
		if (!intervalRef.current) return;

		clearInterval(intervalRef.current);
		intervalRef.current = null;
	}, []);

	// A ResizeObserver reports the initial size on `observe`, which sets the first scroll state.
	useEffect(() => {
		const element = scrollRef.current;

		if (!element) return;

		const observer = new ResizeObserver(updateScrollState);

		observer.observe(element);

		return () => {
			observer.disconnect();
			stopScrolling();
		};
	}, [updateScrollState, stopScrolling]);

	function startScrolling(direction: ScrollDirection) {
		stopScrolling();
		isScrollingRef.current = true;

		intervalRef.current = setInterval(() => {
			const element = scrollRef.current;

			if (!element) return;

			if (isAtBoundary(element, direction)) {
				stopScrolling();

				return;
			}

			element.scrollTop += direction === 'down' ? SCROLL_STEP : -SCROLL_STEP;
		}, SCROLL_INTERVAL_MS);
	}

	function handleMouseLeave() {
		setIsHovered(false);
		stopScrolling();
		isScrollingRef.current = false;
	}

	function handleMouseUpCapture() {
		if (!isScrollingRef.current) return;

		stopScrolling();
		isScrollingRef.current = false;
	}

	// A press-and-hold on an arrow must not also count as a click on the item underneath it.
	function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
		if (!isScrollingRef.current) return;

		event.stopPropagation();
		event.preventDefault();
		isScrollingRef.current = false;
	}

	return (
		<div
			className={cn('relative', className)}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={handleMouseLeave}
			onMouseUpCapture={handleMouseUpCapture}
			onClickCapture={handleClickCapture}
			{...props}
		>
			<div
				ref={scrollRef}
				className={cn(maxHeight, 'hide-scrollbar overflow-y-auto')}
				onScroll={updateScrollState}
			>
				{children}
			</div>

			<AnimatePresence mode='popLayout'>
				{isHovered && canScrollUp ? (
					<ScrollHintArrow
						key='scroll-up'
						direction='up'
						onStart={startScrolling}
						onStop={stopScrolling}
					/>
				) : null}
			</AnimatePresence>

			<AnimatePresence mode='popLayout'>
				{isHovered && canScrollDown ? (
					<ScrollHintArrow
						key='scroll-down'
						direction='down'
						onStart={startScrolling}
						onStop={stopScrolling}
					/>
				) : null}
			</AnimatePresence>
		</div>
	);
}

export default ScrollHint;
