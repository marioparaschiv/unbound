import { IconChevronRight } from 'nucleo-micro-bold';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { SidebarCard } from '~/components/addon/sidebar-card';
import type { ResolvedAuthor } from '~/lib/authors/resolve';
import { authorKey } from '~/components/author-byline';
import UserAvatar from '~/components/user-avatar';
import UserBadge from '~/components/user-badge';
import Text from '~/components/ui/text';

type AuthorsCardProps = {
	authors: ResolvedAuthor[];
};

type AuthorRowProps = {
	author: ResolvedAuthor;
};

type GhostRowProps = {
	author: ResolvedAuthor;
	children: ReactNode;
};

const GHOST =
	'group flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-control outline-none press-flat hover:bg-accent dark:hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-halo';

function handle(author: ResolvedAuthor): string | null {
	if (author.kind === 'discord') {
		return `@${author.username}`;
	}

	if (author.kind === 'user') {
		return 'Unbound member';
	}

	return null;
}

// The whole row is the hit target, lit like a ghost button, so the profile link reads as one control.
function GhostRow({ author, children }: GhostRowProps) {
	if (author.discordId === null) {
		return <div className='flex items-center gap-3 py-1.5'>{children}</div>;
	}

	return (
		<Link to='/profiles/$discordId' params={{ discordId: author.discordId }} className={GHOST}>
			{children}
			<IconChevronRight className='opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 size-3.5 text-muted-foreground transition-[opacity,translate] -translate-x-1 group-hover:translate-x-0 duration-150' />
		</Link>
	);
}

function AuthorRow({ author }: AuthorRowProps) {
	const subtitle = handle(author);

	return (
		<GhostRow author={author}>
			<UserAvatar
				size='sm'
				className='rounded-item object-cover'
				src={author.avatarUrl}
				name={author.name}
			/>
			<span className='flex flex-col flex-1 min-w-0'>
				<Text as='span' variant='text-sm' className='font-medium truncate'>
					{author.name}
				</Text>
				{subtitle ? (
					<Text as='span' variant='text-xs' color='muted' className='truncate'>
						{subtitle}
					</Text>
				) : null}
			</span>
			{author.kind === 'user' && author.badge ? <UserBadge badge={author.badge} /> : null}
		</GhostRow>
	);
}

/** The people the addon's manifest credits. */
function AuthorsCard({ authors }: AuthorsCardProps) {
	return (
		<SidebarCard
			title={
				authors.length === 1 ? (
					'Author'
				) : (
					<>
						Authors <span className='ml-1 text-muted-foreground'>{authors.length}</span>
					</>
				)
			}
		>
			<div className='flex flex-col gap-0.5'>
				{authors.map((author) => (
					<AuthorRow key={authorKey(author)} author={author} />
				))}
			</div>
		</SidebarCard>
	);
}

export default AuthorsCard;
