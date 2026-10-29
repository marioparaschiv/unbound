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
import VersionHistory from '~/components/addon/version-history';
import { staggerStyle } from '~/components/motion/reveal-style';
import AddonHeader from '~/components/addon/addon-header';
import AuthorsCard from '~/components/addon/authors-card';
import ScrollShadow from '~/components/ui/scroll-shadow';
import { addonQuery } from '~/queries/marketplace/addon';
import AboutCard from '~/components/addon/about-card';
import { Button } from '~/components/ui/button';
import Markdown from '~/components/markdown';
import Text from '~/components/ui/text';

function AddonPage() {
	const { id } = Route.useParams();
	const { data: addon } = useSuspenseQuery(addonQuery(id));

	// A refetch can find the addon delisted since the page loaded.
	if (!addon) {
		throw notFound();
	}

	const { source } = addon;
	const sidebar = [
		<AuthorsCard key='authors' authors={addon.authors} />,
		<Card key='changelog' className='gap-4'>
			<CardHeader>
				<CardTitle>What's New</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollShadow
					contentClassName='max-h-96 overflow-y-auto overscroll-contain [scrollbar-width:thin]'
					shadowClassName='inset-x-0 h-10'
					fromClassName='from-card'
				>
					<VersionHistory versions={addon.versions} />
				</ScrollShadow>
			</CardContent>
		</Card>,
		<AboutCard key='about' addon={addon} />,
	].map((card, index) => (
		<div key={card.key} className='min-w-0 animate-reveal' style={staggerStyle(4 + index)}>
			{card}
		</div>
	));

	return (
		<div className='flex flex-col flex-1 gap-8 page-frame'>
			<AddonHeader addon={addon} />

			<div className='items-start gap-6 grid grid-cols-1 lg:grid-cols-3'>
				<Card className='lg:col-span-2 min-w-0 animate-reveal' style={staggerStyle(4)}>
					<CardContent>
						{/* Without an ADDON.md the manifest description stands in, as review and submit tell authors. */}
						{source?.addonMd ? (
							<Markdown source={source.addonMd} pin={source.pin} />
						) : (
							<Text variant='text-md' color='muted'>
								{addon.description}
							</Text>
						)}
					</CardContent>
				</Card>
				<aside className='flex flex-col gap-6 min-w-0'>{sidebar}</aside>
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
