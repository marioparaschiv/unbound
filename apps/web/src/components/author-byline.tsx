import { Link } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

import type { ResolvedAuthor } from '~/lib/authors/resolve';
import AvatarPile from '~/components/ui/avatar-pile';
import UserAvatar from '~/components/user-avatar';
import cn from '~/lib/cn';

type AuthorBylineProps = ComponentProps<'span'> & {
	authors: ResolvedAuthor[];
	linkProfiles?: boolean;
};

type AuthorNameProps = {
	author: ResolvedAuthor;
	linkProfiles: boolean;
};

/**
 * @description Builds a stable React key for a resolved author.
 * @param author The author.
 * @returns The Discord id, or the name for an author without one.
 */
export function authorKey(author: ResolvedAuthor): string {
	return author.discordId ?? `0:${author.name}`;
}

function AuthorName({ author, linkProfiles }: AuthorNameProps) {
	if (!linkProfiles || author.kind !== 'user') {
		return <span>{author.name}</span>;
	}

	return (
		<Link
			to='/developers/$discordId'
			params={{ discordId: author.discordId }}
			className='underline-offset-4 hover:underline'
		>
			{author.name}
		</Link>
	);
}

// Discord's piles show three avatars, then a "+N" chip.
const MAX_AVATARS = 3;

/** "by" followed by the authors' avatars in a pile, then their names. */
function AuthorByline({ authors, linkProfiles = false, className, ...props }: AuthorBylineProps) {
	return (
		<span
			className={cn('inline-flex items-center gap-1.5 min-w-0 max-w-full', className)}
			{...props}
		>
			by
			<AvatarPile size={16} totalCount={authors.length} aria-hidden>
				{authors.slice(0, MAX_AVATARS).map((author) => (
					<UserAvatar
						key={authorKey(author)}
						className='text-[10px]'
						src={author.avatarUrl}
						name={author.name}
					/>
				))}
			</AvatarPile>
			<span className='truncate'>
				{authors.map((author, index) => (
					<span key={authorKey(author)}>
						<AuthorName author={author} linkProfiles={linkProfiles} />
						{index < authors.length - 1 ? ', ' : null}
					</span>
				))}
			</span>
		</span>
	);
}

export default AuthorByline;
