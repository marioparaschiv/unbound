import { Link } from '@tanstack/react-router';
import type { ComponentProps } from 'react';

import type { ResolvedAuthor } from '~/lib/authors/resolve';
import UserAvatar from '~/components/user-avatar';
import cn from '~/lib/cn';

type AuthorBylineProps = ComponentProps<'span'> & {
	authors: ResolvedAuthor[];
	/** Links linked Unbound users to their profile. Off inside a card that is itself a link. */
	linked?: boolean;
};

type AuthorNameProps = {
	author: ResolvedAuthor;
	linked: boolean;
};

/**
 * @description Builds a stable React key for a resolved author.
 * @param author The author.
 * @returns The Discord id, or the name for an author without one.
 */
export function authorKey(author: ResolvedAuthor): string {
	return author.discordId ?? `0:${author.name}`;
}

function AuthorName({ author, linked }: AuthorNameProps) {
	if (!linked || author.kind !== 'user') {
		return <span className='truncate'>{author.name}</span>;
	}

	return (
		<Link
			to='/developers/$discordId'
			params={{ discordId: author.discordId }}
			className='truncate underline-offset-4 hover:underline'
		>
			{author.name}
		</Link>
	);
}

/** "by" followed by each author's avatar and name. */
function AuthorByline({ authors, linked = false, className, ...props }: AuthorBylineProps) {
	return (
		<span
			className={cn(
				'inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 min-w-0',
				className,
			)}
			{...props}
		>
			by
			{authors.map((author, index) => (
				<span key={authorKey(author)} className='inline-flex items-center gap-1 min-w-0'>
					<UserAvatar
						className='size-4 text-[10px]'
						src={author.avatarUrl}
						name={author.name}
					/>
					<span className='inline-flex min-w-0'>
						<AuthorName author={author} linked={linked} />
						{index < authors.length - 1 ? ',' : null}
					</span>
				</span>
			))}
		</span>
	);
}

export default AuthorByline;
