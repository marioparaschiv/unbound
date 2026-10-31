import { animated, useReducedMotion, useSpring } from '@react-spring/web';
import type { SpringConfig } from '@react-spring/web';
import { useLayoutEffect, useRef } from 'react';
import type { ReactNode } from 'react';

type MorphHeightProps = {
	children: ReactNode;
	config: SpringConfig;
};

/**
 * @description Exponential ease-out: nearly all of the move happens at once, then it glides in.
 * @param progress Linear progress from 0 to 1.
 * @returns Eased progress.
 */
export function expoOut(progress: number): number {
	return progress >= 1 ? 1 : 1 - 2 ** (-10 * progress);
}

/** Touch: fast and critically damped, so a finger-driven menu settles without overshoot. */
export const MORPH_SPRING: SpringConfig = { tension: 520, friction: 46 };

/** Pointer: an expo curve reads as instant under a mouse yet still shows where the edge went. */
export const MORPH_EXPO: SpringConfig = { duration: 280, easing: expoOut };

/**
 * @description Animates its height to follow its content, so a menu grows and shrinks instead of jumping.
 * @param props The content to measure, and the timing to animate with.
 * @returns The animated wrapper.
 */
function MorphHeight({ children, config }: MorphHeightProps) {
	const inner = useRef<HTMLDivElement>(null);
	const reduced = useReducedMotion();
	const measured = useRef(false);
	// Driven imperatively: a resize starts the animation without re-rendering the menu's rows.
	const [style, spring] = useSpring(() => ({ height: 0 }));

	useLayoutEffect(() => {
		const node = inner.current;

		if (!node) return;

		const observer = new ResizeObserver(() => {
			// The first size is where the menu opens, not a change to animate.
			void spring.start({
				height: node.offsetHeight,
				immediate: !measured.current || Boolean(reduced),
				config,
			});
			measured.current = true;
		});

		observer.observe(node);

		return () => observer.disconnect();
	}, [spring, reduced, config]);

	// Only this clip box changes size. The rows sit on their own compositor layer at a fixed size,
	// so each frame relayouts one empty box and repaints its edge, never the list.
	return (
		<animated.div style={style} className='overflow-hidden [contain:strict] w-full'>
			<div ref={inner} className='relative [will-change:transform]'>
				{children}
			</div>
		</animated.div>
	);
}

export default MorphHeight;
