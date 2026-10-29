import { IconExternalLink } from 'nucleo-micro-bold';

import { DetailRow, ExternalLink, SidebarCard } from '~/components/addon/sidebar-card';
import { directoryUrl, formatBytes, formatDate } from '~/components/addon/format';
import type { MarketplaceAddonDetails } from '~/lib/marketplace';
import GitHubIcon from '~/components/icons/github';
import Text from '~/components/ui/text';

type AboutCardProps = {
	addon: MarketplaceAddonDetails;
};

/** What a user deciding to install needs: freshness, size, requirements and where the code lives. */
function AboutCard({ addon }: AboutCardProps) {
	const [latest] = addon.versions;
	const pin = addon.source?.pin ?? latest?.source ?? null;

	return (
		<SidebarCard title='About'>
			{latest ? (
				<DetailRow label='Updated'>{formatDate(latest.publishedAt)}</DetailRow>
			) : null}
			{latest ? <DetailRow label='Size'>{formatBytes(latest.bundleSize)}</DetailRow> : null}
			<DetailRow label='Requires'>
				{addon.minClientVersion ? `Unbound ${addon.minClientVersion}+` : 'Any Unbound'}
			</DetailRow>
			{addon.capabilities.length > 0 ? (
				<DetailRow label='Native access'>{addon.capabilities.join(', ')}</DetailRow>
			) : null}
			{pin ? (
				<ExternalLink
					href={directoryUrl(pin)}
					className='flex items-center gap-2.5 bg-muted/50 hover:bg-muted mt-1.5 px-3 py-2 border rounded-control min-w-0 press-flat'
				>
					<GitHubIcon className='size-4 text-muted-foreground shrink-0' />
					<Text as='span' variant='text-sm' className='font-medium truncate'>
						View source
					</Text>
					<IconExternalLink className='ml-auto size-3.5 text-muted-foreground shrink-0' />
				</ExternalLink>
			) : null}
		</SidebarCard>
	);
}

export default AboutCard;
