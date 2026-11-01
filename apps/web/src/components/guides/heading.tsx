import { IconHashtag } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';

import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type HeadingLevel = 'h2' | 'h3' | 'h4';

type HeadingProps = {
	level: HeadingLevel;
	id?: string;
	children?: ReactNode;
};

const VARIANTS = {
	h2: { variant: 'heading-md', className: 'mt-6' },
	h3: { variant: 'heading-sm', className: 'mt-4' },
	h4: { variant: 'text-lg', className: 'mt-2 font-semibold' },
} as const;

/**
 * @description A guide heading whose text links to its own anchor, with a hash mark on hover.
 * @param props The level and the heading's props; `id` comes from the build's slugger.
 * @returns The heading.
 */
function Heading({ level, id, children }: HeadingProps) {
	const style = VARIANTS[level];

	return (
		<Text
			as={level}
			variant={style.variant}
			id={id}
			className={cn('group/heading scroll-mt-6 break-words', style.className)}
		>
			<a href={id ? `#${id}` : undefined} className='inline-flex items-center gap-2'>
				{children}
				<IconHashtag
					aria-hidden
					className='size-4 text-muted-foreground opacity-0 group-hover/heading:opacity-100 transition-opacity shrink-0'
				/>
			</a>
		</Text>
	);
}

export default Heading;
