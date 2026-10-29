import { Link } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

import { Card, CardContent } from '~/components/ui/card';
import AvatarGlow from '~/components/avatar-glow';
import UserAvatar from '~/components/user-avatar';
import type { Developer } from '~/lib/developers';
import UserBadge from '~/components/user-badge';
import Text from '~/components/ui/text';
import cn from '~/lib/cn';

type DeveloperCardProps = ComponentProps<typeof Card> & {
	developer: Developer;
};

/** A team member's or credited author's card, backed by a blur of their avatar. */
function DeveloperCard({ developer, className, ...props }: DeveloperCardProps) {
	const { author, addonCount } = developer;
	const badge = author.kind === 'user' ? author.badge : undefined;

	return (
		<Card
			className={cn(
				'relative isolate overflow-hidden p-0 gap-0 flex-row items-center transition-[translate,box-shadow] duration-(--press-duration) ease-spring hover:-translate-y-0.5 hover:shadow-float motion-reduce:hover:translate-y-0',
				className,
			)}
			{...props}
		>
			{author.avatarUrl ? <AvatarGlow src={author.avatarUrl} className='opacity-40' /> : null}
			<div
				aria-hidden
				className='absolute inset-0 -z-10 rounded-[inherit] bg-card/50 pointer-events-none'
			/>
			<div className='flex items-center justify-center size-12 shrink-0 rounded-control bg-accent m-3 mr-0 overflow-hidden'>
				<UserAvatar
					className='size-full rounded-control object-cover'
					src={author.avatarUrl}
					name={author.name}
				/>
			</div>
			<CardContent className='flex flex-col gap-0.5 p-3 min-w-0'>
				<Text variant='heading-sm' className='truncate leading-tight!'>
					<Link
						to='/profiles/$discordId'
						params={{ discordId: author.discordId }}
						className='after:absolute after:inset-0 after:rounded-surface'
					>
						{author.name}
					</Link>
				</Text>
				{addonCount > 0 || badge ? (
					<div className='flex items-center gap-2 min-w-0'>
						{addonCount > 0 ? (
							<Text variant='text-xs' color='muted'>
								{addonCount} {addonCount === 1 ? 'addon' : 'addons'}
							</Text>
						) : null}
						{badge ? <UserBadge badge={badge} /> : null}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

export default DeveloperCard;
