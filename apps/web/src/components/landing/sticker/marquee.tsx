import { motion, useReducedMotion } from 'motion/react';

import cn from '~/lib/cn';

type MarqueeProps = {
	items: string[];
	reverse?: boolean;
	className?: string;
};

const CHIP_COLORS = [
	'bg-[#5865F2] text-white',
	'bg-[#EB459E] text-white',
	'bg-[#FEE75C] text-black',
	'bg-[#57F287] text-black',
	'bg-white text-black',
];

/**
 * @description An endless row of addon-name chips that scrolls sideways, and holds still under reduced motion.
 * @param props The names, the scroll direction and extra classes for the row.
 * @returns The marquee row.
 */
function Marquee({ items, reverse = false, className }: MarqueeProps) {
	const reduceMotion = useReducedMotion();
	const from = reverse ? '-50%' : '0%';
	const to = reverse ? '0%' : '-50%';

	return (
		<div className={cn('flex overflow-hidden', className)}>
			<ul className='sr-only'>
				{items.map((name) => (
					<li key={name}>{name}</li>
				))}
			</ul>
			<motion.ul
				aria-hidden
				className='flex gap-3 pr-3 w-max shrink-0'
				animate={reduceMotion ? undefined : { x: [from, to] }}
				transition={{ duration: items.length * 2.2, ease: 'linear', repeat: Infinity }}
			>
				{[...items, ...items].map((name, index) => (
					<li
						key={`${name}-${index}`}
						className={cn(
							'px-5 py-2 rounded-full font-secondary font-bold text-lg md:text-2xl whitespace-nowrap',
							CHIP_COLORS[index % CHIP_COLORS.length],
						)}
					>
						{name}
					</li>
				))}
			</motion.ul>
		</div>
	);
}

export default Marquee;
