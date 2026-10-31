import type { SubmissionPreview as Preview } from '@unbound-app/contracts/review';

import { SubmitSection } from '~/components/submit/submit-section';
import ChangelogSections from '~/components/changelog-sections';
import Separator from '~/components/ui/separator';
import Markdown from '~/components/markdown';
import Text from '~/components/ui/text';

type SubmissionPreviewProps = {
	preview: Preview;
};

/** The addon page as this submission would publish it: its ADDON.md and this version's changelog. */
function SubmissionPreview({ preview }: SubmissionPreviewProps) {
	const { manifest, source } = preview;

	return (
		<SubmitSection
			title='Preview'
			description={`How ${manifest.name} ${manifest.version} reads on its addon page.`}
		>
			<div className='flex flex-col gap-6'>
				{preview.addonMd ? (
					<Markdown source={preview.addonMd} pin={source} />
				) : (
					<div className='flex flex-col gap-1'>
						<Text variant='text-md' color='muted'>
							{manifest.description}
						</Text>
						<Text variant='text-xs' color='muted'>
							No ADDON.md; the manifest description is shown instead.
						</Text>
					</div>
				)}

				<Separator />

				<div className='flex flex-col gap-3'>
					<Text as='h4' variant='text-sm' className='font-semibold'>
						What's New in {manifest.version}
					</Text>
					{preview.changelog ? (
						<ChangelogSections changelog={preview.changelog} />
					) : (
						<Text variant='text-sm' color='muted'>
							No CHANGELOG.md.
						</Text>
					)}
				</div>
			</div>
		</SubmitSection>
	);
}

export default SubmissionPreview;
