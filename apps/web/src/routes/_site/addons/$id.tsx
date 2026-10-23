import { IconMoodEmpty, IconPalette, IconPlug } from '@tabler/icons-react';
import { createFileRoute, Link, notFound } from '@tanstack/react-router';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import type { MarketplaceAddonDetails, MarketplaceVersion } from '~/lib/marketplace';
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card';
import InstallAddonButton from '~/components/install-addon-button';
import { fetchMarketplaceAddon } from '~/lib/marketplace';
import Separator from '~/components/ui/separator';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import UserBadge from '~/components/user-badge';
import Text from '~/components/ui/text';

type AddonProps = {
	addon: MarketplaceAddonDetails;
};

type VersionEntryProps = {
	version: MarketplaceVersion;
	latest: boolean;
};

type DetailRowProps = {
	label: string;
	value: string;
};

const DATE_FORMAT = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'UTC' });

const TYPE_LABELS: Record<MarketplaceAddonDetails['type'], string> = {
	plugin: 'Plugin',
	theme: 'Theme',
	'icon-pack': 'Icon Pack',
	font: 'Font',
};

function formatDate(iso: string): string {
	return DATE_FORMAT.format(new Date(iso));
}

function DetailRow({ label, value }: DetailRowProps) {
	return (
		<div className='flex justify-between gap-4'>
			<Text variant='text-sm' color='muted'>
				{label}
			</Text>
			<Text variant='text-sm' className='text-right break-all'>
				{value}
			</Text>
		</div>
	);
}

function VersionEntry({ version, latest }: VersionEntryProps) {
	return (
		<div className='flex flex-col gap-2'>
			<div className='flex items-center gap-2'>
				<Text variant='heading-sm' as='h3'>
					v{version.version}
				</Text>
				{latest ? (
					<span className='bg-primary px-1.5 py-0.5 rounded-md text-primary-foreground text-xs'>
						Latest
					</span>
				) : null}
				<Text variant='text-xs' color='muted' className='ml-auto'>
					{formatDate(version.publishedAt)}
				</Text>
			</div>
			<Text variant='text-sm' color='muted' className='whitespace-pre-wrap'>
				{version.changelog ?? 'No changelog.'}
			</Text>
		</div>
	);
}

function AddonHeader({ addon }: AddonProps) {
	return (
		<div className='flex sm:flex-row flex-col sm:items-center gap-4'>
			<div className='flex justify-center items-center bg-accent rounded-xl size-16 shrink-0'>
				{addon.type === 'theme' ? (
					<IconPalette className='size-8' />
				) : (
					<IconPlug className='size-8' />
				)}
			</div>
			<div className='flex flex-col flex-1 gap-1 min-w-0'>
				<Text variant='heading-lg' className='truncate'>
					{addon.name}
				</Text>
				<Text variant='text-sm' color='muted'>
					by {addon.authors.map((author) => author.name).join(', ')} · v{addon.version}
				</Text>
			</div>
			<InstallAddonButton size='lg' type={addon.type} manifestUrl={addon.manifestUrl} />
		</div>
	);
}

function AddonPage() {
	const addon = Route.useLoaderData();
	const [latest] = addon.versions;

	return (
		<div className='flex flex-col flex-1 gap-6 md:mx-auto mb-12 px-4 w-full container'>
			<AddonHeader addon={addon} />
			<Text variant='text-md' color='muted'>
				{addon.description}
			</Text>

			<div className='gap-6 grid grid-cols-1 md:grid-cols-3'>
				<Card className='md:col-span-2'>
					<CardHeader>
						<CardTitle>Version History</CardTitle>
					</CardHeader>
					<CardContent className='flex flex-col gap-4'>
						{addon.versions.map((version, index) => (
							<div key={version.version} className='flex flex-col gap-4'>
								{index > 0 ? <Separator /> : null}
								<VersionEntry version={version} latest={version === latest} />
							</div>
						))}
					</CardContent>
				</Card>

				<div className='flex flex-col gap-6'>
					<Card>
						<CardHeader>
							<CardTitle>Details</CardTitle>
						</CardHeader>
						<CardContent className='flex flex-col gap-2'>
							<DetailRow label='Type' value={TYPE_LABELS[addon.type]} />
							<DetailRow label='ID' value={addon.id} />
							<DetailRow label='Version' value={addon.version} />
							<DetailRow label='Listed' value={formatDate(addon.createdAt)} />
							{addon.minClientVersion ? (
								<DetailRow
									label='Requires Unbound'
									value={`${addon.minClientVersion} or newer`}
								/>
							) : null}
							{addon.capabilities.length > 0 ? (
								<DetailRow
									label='Native capabilities'
									value={addon.capabilities.join(', ')}
								/>
							) : null}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>Maintainers</CardTitle>
						</CardHeader>
						<CardContent className='flex flex-col gap-3'>
							{addon.maintainers.map((maintainer) => (
								<div key={maintainer.id} className='flex items-center gap-3'>
									<UserAvatar
										className='rounded-lg size-8 object-cover'
										src={maintainer.image}
										name={maintainer.name}
									/>
									<Text variant='text-sm' className='flex-1 truncate'>
										{maintainer.name}
									</Text>
									{maintainer.badge ? (
										<UserBadge badge={maintainer.badge} />
									) : null}
									<Text variant='text-xs' color='muted' className='capitalize'>
										{maintainer.role}
									</Text>
								</div>
							))}
						</CardContent>
					</Card>
				</div>
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
		meta: [{ title: loaderData ? `Unbound | ${loaderData.name}` : 'Unbound | Addon' }],
	}),
	component: AddonPage,
	notFoundComponent: AddonNotFound,
});
