import { IconBrandGithub, IconStar } from '@tabler/icons-react';

import { directoryUrl, formatCount, formatDate, shortSha } from '~/components/addon/format';
import { DetailRow, ExternalLink, SidebarCard } from '~/components/addon/sidebar-card';
import type { MarketplaceSource } from '~/lib/marketplace';
import Text from '~/components/ui/text';

type SourceCardProps = {
	source: MarketplaceSource;
};

function hostname(url: string): string {
	return new URL(url).hostname.replace(/^www\./, '');
}

/** Where the newest version was read from, and the repository as GitHub described it then. */
function SourceCard({ source }: SourceCardProps) {
	const { pin, details, approvedAt } = source;
	const release = details.latestRelease;

	return (
		<SidebarCard title='Source'>
			<ExternalLink
				href={`https://github.com/${pin.repository}/tree/${pin.commitSha}`}
				className='group flex items-center gap-2.5 bg-muted/50 hover:bg-muted px-3 py-2 border rounded-control min-w-0 press-flat'
			>
				<IconBrandGithub className='size-4 text-muted-foreground shrink-0' />
				<Text as='span' variant='text-sm' className='font-medium truncate'>
					{pin.repository}
				</Text>
				<Text
					as='span'
					variant='text-xs'
					color='muted'
					className='ml-auto font-mono shrink-0'
				>
					@ {shortSha(pin.commitSha)}
				</Text>
			</ExternalLink>
			{pin.path ? (
				<DetailRow label='Directory'>
					<ExternalLink href={directoryUrl(pin)}>
						<span className='font-mono text-xs'>{pin.path}</span>
					</ExternalLink>
				</DetailRow>
			) : null}
			{details.license ? <DetailRow label='License'>{details.license}</DetailRow> : null}
			<DetailRow label='Stars'>
				<span className='inline-flex items-center gap-1'>
					<IconStar className='size-3.5 text-muted-foreground' />
					{formatCount(details.stars)}
				</span>
				<Text as='span' variant='text-xs' color='muted' className='block'>
					as of {formatDate(approvedAt)}
				</Text>
			</DetailRow>
			{details.homepage ? (
				<DetailRow label='Homepage'>
					<ExternalLink href={details.homepage}>
						{hostname(details.homepage)}
					</ExternalLink>
				</DetailRow>
			) : null}
			{details.readmeUrl ? (
				<DetailRow label='README'>
					<ExternalLink href={details.readmeUrl}>Read on GitHub</ExternalLink>
				</DetailRow>
			) : null}
			{release ? (
				<DetailRow label='Latest release'>
					<ExternalLink href={release.url}>{release.name ?? release.tag}</ExternalLink>
					{release.publishedAt ? (
						<Text as='span' variant='text-xs' color='muted' className='block'>
							{formatDate(release.publishedAt)}
						</Text>
					) : null}
				</DetailRow>
			) : null}
		</SidebarCard>
	);
}

export default SourceCard;
