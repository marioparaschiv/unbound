import { IconPalette, IconPlug } from '@tabler/icons-react';

import InstallAddonButton from '~/components/install-addon-button';
import type { MarketplaceAddonDetails } from '~/lib/marketplace';
import AuthorByline from '~/components/author-byline';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type AddonHeaderProps = {
	addon: MarketplaceAddonDetails;
};

/** The addon's identity, install button and repository tags. */
function AddonHeader({ addon }: AddonHeaderProps) {
	const tags = addon.source?.details.tags ?? [];
	const Icon = addon.type === 'theme' ? IconPalette : IconPlug;

	return (
		<header className='flex flex-col gap-4'>
			<div className='flex sm:flex-row flex-col sm:items-center gap-4'>
				<div className='flex justify-center items-center bg-accent border rounded-xl size-16 shrink-0'>
					<Icon className='size-8' />
				</div>
				<div className='flex flex-col flex-1 gap-1 min-w-0'>
					<Text as='h1' variant='heading-lg' className='truncate'>
						{addon.name}
					</Text>
					<Text
						as='div'
						variant='text-sm'
						color='muted'
						className='flex flex-wrap gap-1.5'
					>
						<AuthorByline authors={addon.authors} linkProfiles />
						<span>· v{addon.version}</span>
					</Text>
				</div>
				<InstallAddonButton size='lg' type={addon.type} manifestUrl={addon.manifestUrl} />
			</div>
			<Text variant='text-md' color='muted' className='max-w-3xl'>
				{addon.description}
			</Text>
			{tags.length > 0 ? (
				<ul className='flex flex-wrap gap-1.5' aria-label='Tags'>
					{tags.map((tag) => (
						<li key={tag}>
							<Tag className='px-2 py-1 text-xs'>{tag}</Tag>
						</li>
					))}
				</ul>
			) : null}
		</header>
	);
}

export default AddonHeader;
