import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { addonAuthorSchema } from '@unbound-app/contracts/manifest';
import { createServerFn } from '@tanstack/react-start';
import { IconMoodEmpty } from '@tabler/icons-react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import type { IdentifiedAuthor } from '~/lib/authors/resolve';
import { formatDate } from '~/components/addon/format';
import type { CssVariables } from '~/lib/css-variables';
import UserAvatar from '~/components/user-avatar';
import AddonCard from '~/components/addon-card';
import { getDeveloper } from '~/lib/developers';
import { Button } from '~/components/ui/button';
import UserBadge from '~/components/user-badge';
import Text from '~/components/ui/text';
import app from '~/lib/app';

type DeveloperDetailsProps = {
	author: IdentifiedAuthor;
};

const GRID_STYLE: CssVariables = { '--col-width': '300px' };

const fetchDeveloper = createServerFn({ method: 'GET' })
	.validator(addonAuthorSchema.shape.id)
	.handler(async ({ data }) => (await getDeveloper(app, data)) ?? null);

function DeveloperDetails({ author }: DeveloperDetailsProps) {
	switch (author.kind) {
		case 'user':
			return (
				<>
					<span className='capitalize'>{author.role}</span> · Member since{' '}
					{formatDate(author.memberSince)}
				</>
			);
		case 'discord':
			return <>@{author.username}</>;
		case 'manifest':
			return null;
	}
}

function DeveloperPage() {
	const { author, addons } = Route.useLoaderData();

	return (
		<div className='flex flex-col flex-1 gap-8 md:mx-auto mb-12 px-4 w-full container'>
			<header className='flex sm:flex-row flex-col sm:items-center gap-4'>
				<UserAvatar
					size='xl'
					className='rounded-xl object-cover'
					src={author.avatarUrl}
					name={author.name}
				/>
				<div className='flex flex-col flex-1 gap-1 min-w-0'>
					<div className='flex items-center gap-2 min-w-0'>
						<Text as='h1' variant='heading-lg' className='truncate'>
							{author.name}
						</Text>
						{author.kind === 'user' && author.badge ? (
							<UserBadge badge={author.badge} />
						) : null}
					</div>
					<Text variant='text-sm' color='muted'>
						<DeveloperDetails author={author} />
					</Text>
				</div>
			</header>

			<div className='flex flex-col gap-4'>
				<Text as='h2' variant='heading-sm'>
					Addons
				</Text>
				<div style={GRID_STYLE} className='fill-grid gap-3'>
					{addons.map((addon) => (
						<AddonCard addon={addon} key={addon.id} />
					))}
				</div>
			</div>
		</div>
	);
}

function DeveloperNotFound() {
	return (
		<Empty className='flex-1 my-auto'>
			<EmptyHeader>
				<EmptyMedia variant='icon'>
					<IconMoodEmpty />
				</EmptyMedia>
				<EmptyTitle>Developer Not Found</EmptyTitle>
				<EmptyDescription>No listed addon credits this developer.</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to='/developers'>Browse Developers</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export const Route = createFileRoute('/_site/developers/$discordId')({
	// `loader` comes before `head` so `head` can infer the loader data's type.
	loader: async ({ params }) => {
		const parsed = addonAuthorSchema.shape.id.safeParse(params.discordId);
		const developer = parsed.success ? await fetchDeveloper({ data: parsed.data }) : null;

		if (!developer) {
			throw notFound();
		}

		return developer;
	},
	head: ({ loaderData }) => ({
		meta: [
			{ title: loaderData ? `Unbound | ${loaderData.author.name}` : 'Unbound | Developer' },
		],
	}),
	component: DeveloperPage,
	notFoundComponent: DeveloperNotFound,
});
