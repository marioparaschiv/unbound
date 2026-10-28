import { IconCodeCommit } from 'nucleo-micro-bold';

import { commitUrl, formatDate, shortSha } from '~/components/addon/format';
import ChangelogSections from '~/components/changelog-sections';
import { ExternalLink } from '~/components/addon/sidebar-card';
import type { MarketplaceVersion } from '~/lib/marketplace';
import Separator from '~/components/ui/separator';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type VersionHistoryProps = {
	versions: MarketplaceVersion[];
};

type VersionEntryProps = {
	version: MarketplaceVersion;
	latest: boolean;
};

type VersionChangelogProps = Pick<MarketplaceVersion, 'changelog' | 'changes'>;

function VersionChangelog({ changelog, changes }: VersionChangelogProps) {
	if (changes && changes.sections.length > 0) {
		return <ChangelogSections changelog={changes} />;
	}

	return (
		<Text variant='text-sm' color='muted' className='whitespace-pre-wrap'>
			{changelog ?? 'No changelog.'}
		</Text>
	);
}

function VersionEntry({ version, latest }: VersionEntryProps) {
	return (
		<article className='flex flex-col gap-3'>
			<div className='flex flex-wrap items-center gap-x-2 gap-y-1'>
				<Text variant='heading-sm' as='h3'>
					v{version.version}
				</Text>
				{latest ? <Tag variant='primary'>Latest</Tag> : null}
				<div className='flex items-center gap-3 ml-auto'>
					{version.source ? (
						<ExternalLink
							href={commitUrl(version.source)}
							className='inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground text-xs transition-colors'
						>
							<IconCodeCommit className='size-3.5' />
							{shortSha(version.source.commitSha)}
						</ExternalLink>
					) : null}
					<Text as='time' variant='text-xs' color='muted' dateTime={version.publishedAt}>
						{formatDate(version.publishedAt)}
					</Text>
				</div>
			</div>
			<VersionChangelog changelog={version.changelog} changes={version.changes} />
		</article>
	);
}

/** Every approved version, newest first, with what changed in each. */
function VersionHistory({ versions }: VersionHistoryProps) {
	return (
		<div className='flex flex-col gap-5'>
			{versions.map((version, index) => (
				<div key={version.version} className='flex flex-col gap-5'>
					{index > 0 ? <Separator /> : null}
					<VersionEntry version={version} latest={index === 0} />
				</div>
			))}
		</div>
	);
}

export default VersionHistory;
