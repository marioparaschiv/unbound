import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { IconBox, IconFaceNeutral } from 'nucleo-micro-bold';
import { useSuspenseQuery } from '@tanstack/react-query';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { developerQuery } from '~/queries/developers/developers';
import { staggerStyle } from '~/components/motion/reveal-style';
import type { IdentifiedAuthor } from '~/lib/authors/resolve';
import BlurReveal from '~/components/motion/blur-reveal';
import TEAM_GROUPS from '~/components/team/team-groups';
import type { CssVariables } from '~/lib/css-variables';
import { formatDate } from '~/components/addon/format';
import AvatarGlow from '~/components/avatar-glow';
import UserAvatar from '~/components/user-avatar';
import AddonCard from '~/components/addon-card';
import { Button } from '~/components/ui/button';
import UserBadge from '~/components/user-badge';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type DeveloperDetailsProps = {
	author: IdentifiedAuthor;
};

const GRID_STYLE: CssVariables = { '--col-width': '300px' };

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
	const { discordId } = Route.useParams();
	const { data: developer } = useSuspenseQuery(developerQuery(discordId));

	// A refetch can find them gone from the team and every listing since the page loaded.
	if (!developer) {
		throw notFound();
	}

	const { author, addons, group } = developer;

	return (
		<div className='flex flex-col flex-1 gap-8 page-frame'>
			<header className='flex flex-col'>
				<div
					aria-hidden
					className='relative isolate h-28 sm:h-40 overflow-hidden rounded-surface border bg-card animate-reveal'
					style={staggerStyle(0)}
				>
					<AvatarGlow src={author.avatarUrl} className='opacity-60' />
				</div>
				<div className='flex sm:flex-row flex-col gap-4 -mt-10 px-4 sm:px-6'>
					<UserAvatar
						size='xl'
						className='relative size-20 text-4xl rounded-surface object-cover ring-4 ring-background animate-reveal'
						style={staggerStyle(0)}
						src={author.avatarUrl}
						name={author.name}
					/>
					<div className='flex flex-col flex-1 gap-1 sm:pt-12 min-w-0'>
						<div className='flex items-center gap-2 min-w-0'>
							<Text as='h1' variant='heading-lg' className='truncate'>
								<BlurReveal text={author.name} />
							</Text>
							<div
								className='flex items-center gap-2 animate-reveal'
								style={staggerStyle(1)}
							>
								{author.kind === 'user' && author.badge ? (
									<UserBadge badge={author.badge} />
								) : null}
								<Tag variant={group === 'addon-developer' ? 'default' : 'primary'}>
									{TEAM_GROUPS[group].member}
								</Tag>
							</div>
						</div>
						<Text
							variant='text-sm'
							color='muted'
							className='animate-reveal'
							style={staggerStyle(1)}
						>
							<DeveloperDetails author={author} />
						</Text>
					</div>
				</div>
			</header>

			<div className='flex flex-col gap-4 animate-reveal' style={staggerStyle(2)}>
				<Text as='h2' variant='heading-sm'>
					Addons
				</Text>
				{addons.length === 0 ? (
					<Empty className='border border-dashed'>
						<EmptyHeader>
							<EmptyMedia variant='icon'>
								<IconBox size={24} />
							</EmptyMedia>
							<EmptyTitle>No Addons Yet</EmptyTitle>
							<EmptyDescription>
								No listed addon credits {author.name} yet.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				) : (
					<div style={GRID_STYLE} className='fill-grid gap-3'>
						{addons.map((addon, index) => (
							<AddonCard
								addon={addon}
								key={addon.id}
								className='animate-reveal'
								style={staggerStyle(index + 3)}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

function DeveloperNotFound() {
	return (
		<Empty className='flex-1 my-auto'>
			<EmptyHeader>
				<EmptyMedia variant='icon'>
					<IconFaceNeutral size={24} />
				</EmptyMedia>
				<EmptyTitle>Not Found</EmptyTitle>
				<EmptyDescription>
					This person is not on the team and no listed addon credits them.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to='/team'>Browse Team</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export const Route = createFileRoute('/_site/profiles/$discordId')({
	// `loader` comes before `head` so `head` can infer the loader data's type.
	loader: async ({ context, params }) => {
		const developer = await context.queryClient.ensureQueryData(
			developerQuery(params.discordId),
		);

		if (!developer) {
			throw notFound();
		}

		return developer;
	},
	head: ({ loaderData }) => ({
		meta: [{ title: loaderData ? `Unbound | ${loaderData.author.name}` : 'Unbound | Team' }],
	}),
	component: DeveloperPage,
	notFoundComponent: DeveloperNotFound,
});
