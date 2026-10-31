import type { SubmissionPreview } from '@unbound-app/contracts/review';
import { IconExternalLink } from 'nucleo-micro-bold';

import { DetailRow, ExternalLink } from '~/components/addon/sidebar-card';
import { directoryUrl, formatBytes } from '~/components/addon/format';
import SourcePinLink from '~/components/source-pin-link';
import GitHubIcon from '~/components/icons/github';
import { getBundleUrl } from '~/lib/github-urls';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type SubmissionSummaryProps = {
	preview: SubmissionPreview;
};

/** The facts a submission pins: kind, version, source commit, bundle and its hash. */
function SubmissionSummary({ preview }: SubmissionSummaryProps) {
	const { manifest, source, details } = preview;

	return (
		<div className='flex flex-col gap-2.5'>
			<DetailRow label='Type'>
				{preview.kind === 'listing' ? (
					<Tag variant='primary'>New listing</Tag>
				) : (
					<Tag>Update</Tag>
				)}
			</DetailRow>
			<DetailRow label='Version'>{manifest.version}</DetailRow>
			<DetailRow label='Source'>
				<SourcePinLink pin={source} />
			</DetailRow>
			<DetailRow label='Bundle'>
				<ExternalLink
					href={getBundleUrl(source)}
					className='font-mono underline-offset-4 hover:underline'
				>
					<span title={source.bundlePath}>{source.bundlePath.split('/').at(-1)}</span>
				</ExternalLink>
				<Text as='span' variant='text-sm' color='muted'>
					{' '}
					· {formatBytes(preview.bundleSize)}
				</Text>
			</DetailRow>
			<DetailRow label='SHA-256'>
				<span title={preview.sha256} className='font-mono'>
					{preview.sha256.slice(0, 12)}…
				</span>
			</DetailRow>
			<DetailRow label='License'>{details.license ?? 'None detected'}</DetailRow>
			<DetailRow label='Stars'>{details.stars.toLocaleString('en-US')}</DetailRow>
			<ExternalLink
				href={directoryUrl(source)}
				className='flex items-center gap-2.5 bg-muted/50 hover:bg-muted mt-1.5 px-3 py-2 border rounded-control min-w-0 press-flat'
			>
				<GitHubIcon className='size-4 text-muted-foreground shrink-0' />
				<Text as='span' variant='text-sm' className='font-medium truncate'>
					View source
				</Text>
				<IconExternalLink className='ml-auto size-3.5 text-muted-foreground shrink-0' />
			</ExternalLink>
		</div>
	);
}

export default SubmissionSummary;
