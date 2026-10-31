import { IconCodeCommit } from 'nucleo-micro-bold';

import { commitUrl, formatDate, shortSha } from '~/components/addon/format';
import ChangelogSections from '~/components/changelog-sections';
import { ExternalLink } from '~/components/addon/sidebar-card';
import type { MarketplaceVersion } from '~/lib/marketplace';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';
import cn from '~/lib/cn';

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
		<article className='relative flex flex-col gap-3 pb-6 last:pb-0 pl-6'>
			<span
				className={cn(
					'top-1.5 left-0 absolute border-2 border-card rounded-full size-2.5',
					latest ? 'bg-primary' : 'bg-muted-foreground/40',
				)}
				aria-hidden
			/>
			<div className='flex flex-col gap-0.5'>
				<div className='flex flex-wrap items-center gap-2'>
					<Text
						variant='text-md'
						as='h3'
						className={cn('leading-tight', latest ? 'font-bold' : 'font-medium')}
					>
						v{version.version}
					</Text>
					{latest ? <Tag variant='primary'>Latest</Tag> : null}
				</div>
				<div className='flex flex-wrap items-center gap-x-3 gap-y-1'>
					<Text as='time' variant='text-xs' color='muted' dateTime={version.publishedAt}>
						{formatDate(version.publishedAt)}
					</Text>
					{version.source ? (
						<ExternalLink
							href={commitUrl(version.source)}
							className='inline-flex items-center gap-1 font-mono text-muted-foreground hover:text-foreground text-xs transition-colors'
						>
							<IconCodeCommit className='size-3.5' />
							{shortSha(version.source.commitSha)}
						</ExternalLink>
					) : null}
				</div>
			</div>
			<VersionChangelog changelog={version.changelog} changes={version.changes} />
		</article>
	);
}

/** Every approved version, newest first, on a timeline with what changed in each. */
function VersionHistory({ versions }: VersionHistoryProps) {
	return (
		<div className='relative'>
			<span className='top-2 bottom-2 left-[4.5px] absolute bg-border w-px' aria-hidden />
			{versions.map((version, index) => (
				<VersionEntry key={version.version} version={version} latest={index === 0} />
			))}
		</div>
	);
}

export default VersionHistory;
