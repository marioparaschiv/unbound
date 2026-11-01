import type { Badge } from '@unbound-app/contracts/sponsors';
import type { ComponentProps } from 'react';

import UserBadge from '~/components/user-badge';
import cn from '~/lib/cn';

type UserBadgeListProps = ComponentProps<'span'> & {
	badges: Badge[];
};

/** A sponsor's badges in their order, wrapping onto more lines when they do not fit. */
function UserBadgeList({ badges, className, ...props }: UserBadgeListProps) {
	if (badges.length === 0) return null;

	return (
		<span className={cn('flex flex-wrap items-center gap-1', className)} {...props}>
			{badges.map((badge) => (
				<UserBadge key={badge.label} badge={badge} />
			))}
		</span>
	);
}

export default UserBadgeList;
