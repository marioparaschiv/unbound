import { IconGem, IconHashtag, IconGift } from 'nucleo-micro-bold';
import type { Badge } from '@unbound-app/contracts/sponsors';

import { BADGE_COLOR_CLASSES, BADGE_ICON_COMPONENTS } from '~/components/user-badge';
import AvatarGlow from '~/components/avatar-glow';
import UserAvatar from '~/components/user-avatar';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type DiscordProfilePreviewProps = {
	name: string;
	image: string | null;
	badges: Badge[];
};

type DiscordBadgeProps = {
	badge: Badge;
};

// Stand-ins for the badges Discord itself shows, kept muted so the sponsor's own ones stand out.
const DISCORD_BADGES = [IconHashtag, IconGem, IconGift];

function DiscordBadge({ badge }: DiscordBadgeProps) {
	const BadgeIcon = BADGE_ICON_COMPONENTS[badge.icon];

	return (
		<span
			title={badge.label}
			className={cn(
				'grid size-6 place-items-center rounded-full',
				BADGE_COLOR_CLASSES[badge.color],
			)}
		>
			<BadgeIcon size={14} aria-hidden />
		</span>
	);
}

/** A sketch of a Discord profile card, to show where sponsor badges appear. */
function DiscordProfilePreview({ name, image, badges }: DiscordProfilePreviewProps) {
	return (
		<div aria-hidden className='overflow-hidden rounded-surface border bg-card'>
			<div className='relative isolate h-16 overflow-hidden bg-primary/40'>
				{image ? <AvatarGlow src={image} className='opacity-70 saturate-200' /> : null}
			</div>
			<div className='flex flex-col gap-3 px-4 pb-4'>
				<UserAvatar
					size='xl'
					className='relative -mt-8 object-cover ring-4 ring-card'
					src={image}
					name={name}
				/>
				<Text variant='heading-sm' className='truncate leading-tight!'>
					{name}
				</Text>
				<div className='flex items-center gap-2 self-start rounded-item bg-muted/60 px-2 py-1.5'>
					{DISCORD_BADGES.map((Icon, index) => (
						<span
							key={index}
							className='grid size-6 place-items-center text-muted-foreground'
						>
							<Icon size={16} aria-hidden />
						</span>
					))}
					{badges.map((badge) => (
						<DiscordBadge key={badge.label} badge={badge} />
					))}
				</div>
			</div>
		</div>
	);
}

export default DiscordProfilePreview;
