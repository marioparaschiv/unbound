import type { SubmissionPreview as Preview } from '@unbound-app/contracts/review';
import type { ReactNode } from 'react';

import ChangelogSections from '~/components/changelog-sections';
import SourcePinLink from '~/components/source-pin-link';
import { getBundleUrl } from '~/lib/github-urls';
import Markdown from '~/components/markdown';
import Text from '~/components/ui/text';
import Tag from '~/components/tag';

type SubmissionPreviewProps = {
	preview: Preview;
};

type FactProps = {
	label: string;
	children: ReactNode;
};

function Fact({ label, children }: FactProps) {
	return (
		<div className='flex flex-col gap-0.5 min-w-0'>
			<Text variant='text-xs' color='muted'>
				{label}
			</Text>
			<Text as='div' variant='text-sm' className='break-all'>
				{children}
			</Text>
		</div>
	);
}

function SubmissionPreview({ preview }: SubmissionPreviewProps) {
	const { manifest, source, details } = preview;

	return (
		<div className='flex flex-col gap-4'>
			<div className='flex flex-wrap items-center gap-2'>
				<Text as='span' variant='text-md' className='font-medium'>
					{manifest.name}
				</Text>
				<Text as='span' variant='text-sm' color='muted' className='font-mono'>
					{manifest.id} {manifest.version}
				</Text>
				<Tag className='uppercase'>
					{preview.kind === 'listing' ? 'New listing' : 'Update'}
				</Tag>
			</div>

			<div className='gap-3 grid sm:grid-cols-2'>
				<Fact label='Source'>
					<SourcePinLink pin={source} /> · {source.path || '/'} · {source.ref}
				</Fact>
				<Fact label='Bundle'>
					<a
						href={getBundleUrl(source)}
						target='_blank'
						rel='noopener noreferrer'
						className='font-mono underline-offset-4 hover:underline'
					>
						{source.bundlePath}
					</a>{' '}
					({preview.bundleSize.toLocaleString('en-US')} bytes)
				</Fact>
				<Fact label='SHA-256'>
					<span className='font-mono'>{preview.sha256}</span>
				</Fact>
				<Fact label='License'>{details.license ?? 'None detected'}</Fact>
				<Fact label='Description'>{details.description ?? 'None'}</Fact>
				<Fact label='Stars'>{details.stars.toLocaleString('en-US')}</Fact>
			</div>

			<div className='flex flex-col gap-1'>
				<Text variant='text-xs' color='muted'>
					Changelog
				</Text>
				{preview.changelog ? (
					<ChangelogSections changelog={preview.changelog} />
				) : (
					<Text variant='text-sm' color='muted'>
						No CHANGELOG.md.
					</Text>
				)}
			</div>

			<div className='flex flex-col gap-1'>
				<Text variant='text-xs' color='muted'>
					ADDON.md
				</Text>
				{preview.addonMd ? (
					<div className='p-4 border border-border rounded-control max-h-[32rem] overflow-auto'>
						<Markdown source={preview.addonMd} pin={source} />
					</div>
				) : (
					<Text variant='text-sm' color='muted'>
						No ADDON.md; the manifest description is shown instead.
					</Text>
				)}
			</div>
		</div>
	);
}

export default SubmissionPreview;
