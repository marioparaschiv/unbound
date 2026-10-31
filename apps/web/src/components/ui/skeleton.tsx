import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

function Skeleton({ className, ...props }: ComponentProps<'div'>) {
	return (
		<div
			data-slot='skeleton'
			className={cn('bg-accent animate-pulse rounded-control', className)}
			{...props}
		/>
	);
}

export default Skeleton;
