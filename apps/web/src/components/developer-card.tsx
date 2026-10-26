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

/** A credited author. Only a linked Unbound user's card links to their profile. */
function DeveloperCard({ developer, className, ...props }: DeveloperCardProps) {
	const { author, addonCount } = developer;

	return (
		<Card
			className={cn(
				'relative p-0 gap-0 rounded-lg transition-transform duration-200 ease-in-out hover:-translate-y-1 hover:shadow-lg flex-row items-center',
				className,
			)}
			{...props}
		>
			<div className='flex items-center justify-center size-10 shrink-0 rounded-lg bg-accent m-4 mr-0 overflow-hidden'>
				<UserAvatar
					className='size-full rounded-lg object-cover'
					src={author.avatarUrl}
					name={author.name}
				/>
			</div>
			<CardContent className='flex flex-col gap-0.5 p-4 min-w-0'>
				<Text variant='heading-sm' className='truncate leading-tight!'>
					{author.kind === 'user' ? (
						<Link
							to='/developers/$discordId'
							params={{ discordId: author.discordId }}
							className='after:absolute after:inset-0 after:rounded-lg'
						>
							{author.name}
						</Link>
					) : (
						author.name
					)}
				</Text>
				<div className='flex items-center gap-2 min-w-0'>
					<Text variant='text-xs' color='muted'>
						{addonCount} {addonCount === 1 ? 'addon' : 'addons'}
					</Text>
					{author.kind === 'user' && author.badge ? (
						<UserBadge badge={author.badge} />
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

export default DeveloperCard;
