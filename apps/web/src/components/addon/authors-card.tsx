import { Link } from '@tanstack/react-router';

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

function AuthorRow({ author }: AuthorRowProps) {
	const name =
		author.discordId === null ? (
			author.name
		) : (
			<Link
				to='/profiles/$discordId'
				params={{ discordId: author.discordId }}
				className='underline-offset-4 hover:underline'
			>
				{author.name}
			</Link>
		);

	return (
		<div className='flex items-center gap-3'>
			<UserAvatar
				size='sm'
				className='rounded-item object-cover'
				src={author.avatarUrl}
				name={author.name}
			/>
			<Text variant='text-sm' className='flex-1 truncate'>
				{name}
			</Text>
			{author.kind === 'user' && author.badge ? <UserBadge badge={author.badge} /> : null}
		</div>
	);
}

/** The people the addon's manifest credits. */
function AuthorsCard({ authors }: AuthorsCardProps) {
	return (
		<SidebarCard title='Authors'>
			{authors.map((author) => (
				<AuthorRow key={authorKey(author)} author={author} />
			))}
		</SidebarCard>
	);
}

export default AuthorsCard;
