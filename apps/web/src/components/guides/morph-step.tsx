import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { useLayoutEffect, useRef, useState } from 'react';
import type { Transition, Variants } from 'motion/react';
import type { ReactNode } from 'react';

/** Which way the steps move: `1` forward, `-1` back. */
export type StepDirection = 1 | -1;

type MorphStepProps = {
	/** Identifies the shown step; a new value swaps the content. */
	step: string;
	direction: StepDirection;
	children: ReactNode;
};

// The site's `--ease-out`: the swap reads as instant, then glides into place.
const TRANSITION: Transition = { duration: 0.32, ease: [0.23, 1, 0.32, 1] };

const SHIFT_PX = 56;

// Forward steps leave to the left and arrive from the right; going back mirrors the path.
const VARIANTS: Variants = {
	enter: (direction: StepDirection) => ({
		x: direction * SHIFT_PX,
		opacity: 0,
		filter: 'blur(8px)',
	}),
	center: { x: 0, opacity: 1, filter: 'blur(0px)' },
	exit: (direction: StepDirection) => ({
		x: direction * -SHIFT_PX,
		opacity: 0,
		filter: 'blur(8px)',
	}),
};

/**
 * @description Swaps steps by blurring the old one out to the side while the new one slides in, and eases
 * the height between them.
 * @param props The step's id, the direction moved and its content.
 * @returns The animated step.
 */
function MorphStep({ step, direction, children }: MorphStepProps) {
	const inner = useRef<HTMLDivElement>(null);
	const [height, setHeight] = useState<number | 'auto'>('auto');

	useLayoutEffect(() => {
		const node = inner.current;

		if (!node) return;

		const observer = new ResizeObserver(() => setHeight(node.offsetHeight));

		observer.observe(node);

		return () => observer.disconnect();
	}, []);

	// The clip is vertical only, so steps slide in from beyond the edges; its padding keeps shadows and focus rings whole.
	return (
		<MotionConfig transition={TRANSITION} reducedMotion='user'>
			<motion.div initial={false} animate={{ height }} className='-my-3 [overflow-y:clip]'>
				<div ref={inner} className='relative py-3'>
					<AnimatePresence mode='popLayout' initial={false} custom={direction}>
						<motion.div
							key={step}
							custom={direction}
							variants={VARIANTS}
							initial='enter'
							animate='center'
							exit='exit'
							className='w-full'
						>
							{children}
						</motion.div>
					</AnimatePresence>
				</div>
			</motion.div>
		</MotionConfig>
	);
}

export default MorphStep;
