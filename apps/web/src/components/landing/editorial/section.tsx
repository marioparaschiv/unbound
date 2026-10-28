import type { ReactNode } from 'react';
import { motion } from 'motion/react';

import cn from '~/lib/cn';

type SectionProps = {
	number: string;
	title: string;
	children: ReactNode;
	className?: string;
};

const HIDDEN = { opacity: 0, y: 24 };
const SHOWN = { opacity: 1, y: 0 };

/**
 * @description A numbered magazine section: a hairline rule, the number and title in the margin, and the body.
 * @param props The section number, its title, its body and extra classes.
 * @returns The section.
 */
function Section({ number, title, children, className }: SectionProps) {
	return (
		<motion.section
			initial={HIDDEN}
			whileInView={SHOWN}
			viewport={{ once: true, amount: 0.2 }}
			transition={{ duration: 0.5, ease: 'easeOut' }}
			className={cn(
				'gap-6 md:gap-10 grid md:grid-cols-[12rem_1fr] pt-6 border-white/15 border-t',
				className,
			)}
		>
			<header className='flex md:flex-col gap-3 md:gap-1'>
				<span className='font-serif text-muted-foreground text-2xl md:text-5xl italic'>
					{number}
				</span>
				<h2 className='self-end md:self-auto font-medium text-muted-foreground text-xs uppercase tracking-[0.2em]'>
					{title}
				</h2>
			</header>
			<div className='min-w-0'>{children}</div>
		</motion.section>
	);
}

export default Section;
