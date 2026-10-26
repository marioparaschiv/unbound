import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { IconMoodEmpty } from '@tabler/icons-react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import ContributorsCard from '~/components/addon/contributors-card';
import AuthorsCard from '~/components/addon/authors-card';
import VersionHistory from '~/components/addon/version-history';
import AddonHeader from '~/components/addon/addon-header';
import DetailsCard from '~/components/addon/details-card';
import { fetchMarketplaceAddon } from '~/lib/marketplace';
import SourceCard from '~/components/addon/source-card';
import { Button } from '~/components/ui/button';
import Markdown from '~/components/markdown';

function AddonPage() {
	const addon = Route.useLoaderData();
	const { source } = addon;

	return (
		<div className='flex flex-col flex-1 gap-8 md:mx-auto mb-12 px-4 w-full container'>
			<AddonHeader addon={addon} />

			<div className='items-start gap-6 grid grid-cols-1 lg:grid-cols-3'>
				<div className='flex flex-col gap-6 lg:col-span-2 min-w-0'>
					{source?.addonMd ? (
						<Card>
							<CardContent>
								<Markdown source={source.addonMd} pin={source.pin} />
							</CardContent>
						</Card>
					) : null}

					<Card>
						<CardHeader>
							<CardTitle>Version History</CardTitle>
						</CardHeader>
						<CardContent>
							<VersionHistory versions={addon.versions} />
						</CardContent>
					</Card>
				</div>

				<aside className='flex flex-col gap-6 min-w-0'>
					{source ? <SourceCard source={source} /> : null}
					{source && source.details.contributors.length > 0 ? (
						<ContributorsCard contributors={source.details.contributors} />
					) : null}
					<DetailsCard addon={addon} />
					<AuthorsCard authors={addon.authors} />
				</aside>
			</div>
		</div>
	);
}

function AddonNotFound() {
	return (
		<Empty className='flex-1 my-auto'>
			<EmptyHeader>
				<EmptyMedia variant='icon'>
					<IconMoodEmpty />
				</EmptyMedia>
				<EmptyTitle>Addon Not Found</EmptyTitle>
				<EmptyDescription>
					This addon does not exist or is no longer listed.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Button asChild>
					<Link to='/plugins'>Browse Plugins</Link>
				</Button>
			</EmptyContent>
		</Empty>
	);
}

export const Route = createFileRoute('/_site/addons/$id')({
	// `loader` comes before `head` so `head` can infer the loader data's type.
	loader: async ({ params }) => {
		const addon = await fetchMarketplaceAddon({ data: params.id });

		if (!addon) {
			throw notFound();
		}

		return addon;
	},
	head: ({ loaderData }) => ({
		meta: [
			{ title: loaderData ? `Unbound | ${loaderData.name}` : 'Unbound | Addon' },
			...(loaderData ? [{ name: 'description', content: loaderData.description }] : []),
		],
	}),
	component: AddonPage,
	notFoundComponent: AddonNotFound,
});
