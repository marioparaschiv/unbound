import { Link } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

import { Card, CardContent } from '~/components/ui/card';
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
			{author.avatarUrl ? (
				<img
					src={author.avatarUrl}
					alt=''
					aria-hidden
					loading='lazy'
					decoding='async'
					className='absolute inset-0 -z-10 size-full object-cover scale-150 blur-3xl saturate-150 opacity-15 pointer-events-none select-none'
				/>
			) : null}
			<div className='flex items-center justify-center size-10 shrink-0 rounded-control bg-accent m-(--card-pad) mr-0 overflow-hidden'>
				<UserAvatar
					className='size-full rounded-control object-cover'
					src={author.avatarUrl}
					name={author.name}
				/>
			</div>
			<CardContent className='flex flex-col gap-0.5 p-(--card-pad) min-w-0'>
				<Text variant='heading-sm' className='truncate leading-tight!'>
					<Link
						to='/developers/$discordId'
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
