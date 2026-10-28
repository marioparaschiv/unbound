import type { ReactNode, RefObject } from 'react';
import { motion } from 'motion/react';

import cn from '~/lib/cn';

type StickerProps = {
	children: ReactNode;
	rotate: number;
	bounds: RefObject<HTMLElement | null>;
	className?: string;
};

const HOVER = { scale: 1.08 };
const GRAB = { scale: 1.12, rotate: 0 };

/**
 * @description A tilted label that can be peeled off and dragged around inside its bounds.
 * @param props The label, its resting tilt, the element it stays inside, and placement classes.
 * @returns The sticker.
 */
function Sticker({ children, rotate, bounds, className }: StickerProps) {
	return (
		<motion.span
			drag
			dragConstraints={bounds}
			dragElastic={0.2}
			initial={{ opacity: 0, scale: 0.6, rotate: rotate * 2 }}
			animate={{ opacity: 1, scale: 1, rotate }}
			whileHover={HOVER}
			whileDrag={GRAB}
			transition={{ type: 'spring', stiffness: 260, damping: 18 }}
			className={cn(
				'z-30 absolute shadow-[0_6px_0_rgba(0,0,0,0.35)] px-2.5 md:px-4 py-1 md:py-2 border-2 border-black rounded-xl md:rounded-2xl font-secondary font-bold text-xs md:text-base whitespace-nowrap cursor-grab active:cursor-grabbing select-none touch-none',
				className,
			)}
		>
			{children}
		</motion.span>
	);
}

export default Sticker;
