import type { HTMLMotionProps } from 'motion/react';
import { motion } from 'motion/react';

type RevealProps = HTMLMotionProps<'div'> & {
	/** Seconds to wait after the element scrolls into view. */
	delay?: number;
};

// Full transform strings rather than `y`, so motion can hand the animation to the compositor.
const HIDDEN = { opacity: 0, transform: 'translateY(16px)', filter: 'blur(4px)' };

// A leftover `blur(0px)` would stop the backdrop blurs inside from seeing the page behind them.
const SHOWN = {
	opacity: 1,
	transform: 'translateY(0px)',
	filter: 'blur(0px)',
	transitionEnd: { transform: 'none', filter: 'none' },
};
const VIEWPORT = { once: true, amount: 0.3 };
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

function Reveal({ delay = 0, ...props }: RevealProps) {
	return (
		<motion.div
			data-reveal
			initial={HIDDEN}
			whileInView={SHOWN}
			viewport={VIEWPORT}
			transition={{ duration: 0.5, ease: EASE_OUT, delay }}
			{...props}
		/>
	);
}

export default Reveal;
