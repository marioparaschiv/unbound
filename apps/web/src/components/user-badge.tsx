import type { PublicBadge } from '@unbound-app/contracts/sponsors';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

/** What a badge shows: its name and image, whether it is the owner's copy or the public one. */
export type ShownBadge = Pick<PublicBadge, 'name' | 'imageUrl'>;

type UserBadgeProps = ComponentProps<'span'> & {
	badge: ShownBadge;
};

function UserBadge({ badge, className, ...props }: UserBadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 pl-0.5 pr-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium text-[11px] leading-none shrink-0 whitespace-nowrap',
				className,
			)}
			title={badge.name}
			{...props}
		>
			<img
				src={badge.imageUrl}
				alt=''
				width={16}
				height={16}
				loading='lazy'
				className='size-4 rounded-full object-contain'
			/>
			{badge.name}
		</span>
	);
}

export default UserBadge;
