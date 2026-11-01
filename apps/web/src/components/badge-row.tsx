import type { ComponentProps } from 'react';

import type { ShownBadge } from '~/components/user-badge';
import cn from '~/lib/cn';

type BadgeRowProps = ComponentProps<'div'> & {
	badges: ShownBadge[];
};

/** A sponsor's badges in a tray like Discord's profile badge row; `children` lead the badges. */
function BadgeRow({ badges, className, children, ...props }: BadgeRowProps) {
	return (
		<div
			className={cn(
				'flex items-center gap-2 self-start rounded-item bg-muted/60 px-2 py-1.5',
				className,
			)}
			{...props}
		>
			{children}
			{badges.map((badge) => (
				<img
					key={badge.name}
					src={badge.imageUrl}
					alt={badge.name}
					title={badge.name}
					width={24}
					height={24}
					loading='lazy'
					className='size-6 object-contain'
				/>
			))}
		</div>
	);
}

export default BadgeRow;
