import { createFileRoute, Link, notFound } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { IconFaceNeutral } from 'nucleo-micro-bold';

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
import VersionHistory from '~/components/addon/version-history';
import AddonHeader from '~/components/addon/addon-header';
import AuthorsCard from '~/components/addon/authors-card';
import DetailsCard from '~/components/addon/details-card';
import { addonQuery } from '~/queries/marketplace/addon';
import SourceCard from '~/components/addon/source-card';
import { Button } from '~/components/ui/button';
import Markdown from '~/components/markdown';

function AddonPage() {
	const { id } = Route.useParams();
	const { data: addon } = useSuspenseQuery(addonQuery(id));

	// A refetch can find the addon delisted since the page loaded.
	if (!addon) {
		throw notFound();
	}

	const { source } = addon;

	return (
		<div className='flex flex-col flex-1 gap-8 page-frame'>
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
					<IconFaceNeutral size={24} />
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
	loader: async ({ context, params }) => {
		const addon = await context.queryClient.ensureQueryData(addonQuery(params.id));

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
