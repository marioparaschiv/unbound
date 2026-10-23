import {
	IconBolt,
	IconCode,
	IconCoffee,
	IconCrown,
	IconFlame,
	IconHeart,
	IconMoon,
	IconMusic,
	IconPalette,
	IconRocket,
	IconSparkles,
	IconStar,
} from '@tabler/icons-react';
import type { Badge, BadgeColor, BadgeIcon } from '@unbound-app/contracts/sponsors';
import type { Icon } from '@tabler/icons-react';
import type { ComponentProps } from 'react';

import cn from '~/lib/cn';

type UserBadgeProps = ComponentProps<'span'> & {
	badge: Badge;
};

export const BADGE_ICON_COMPONENTS: Record<BadgeIcon, Icon> = {
	heart: IconHeart,
	star: IconStar,
	sparkles: IconSparkles,
	bolt: IconBolt,
	flame: IconFlame,
	crown: IconCrown,
	rocket: IconRocket,
	code: IconCode,
	palette: IconPalette,
	music: IconMusic,
	coffee: IconCoffee,
	moon: IconMoon,
};

export const BADGE_COLOR_CLASSES: Record<BadgeColor, string> = {
	pink: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
	red: 'bg-red-500/15 text-red-600 dark:text-red-400',
	orange: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
	yellow: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
	green: 'bg-green-500/15 text-green-700 dark:text-green-400',
	teal: 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
	blue: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
	purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400',
	gray: 'bg-muted text-muted-foreground',
};

function UserBadge({ badge, className, ...props }: UserBadgeProps) {
	const BadgeIconComponent = BADGE_ICON_COMPONENTS[badge.icon];

	return (
		<span
			className={cn(
				'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium text-[11px] leading-none shrink-0 whitespace-nowrap',
				BADGE_COLOR_CLASSES[badge.color],
				className,
			)}
			title='GitHub Sponsor'
			{...props}
		>
			<BadgeIconComponent size={12} aria-hidden />
			{badge.label}
		</span>
	);
}

export default UserBadge;
