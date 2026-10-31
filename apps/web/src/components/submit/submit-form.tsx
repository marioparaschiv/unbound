import type { Submission } from '@unbound-app/contracts/publish';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import type { SubmitActivity } from '~/components/submit/submit-step';
import SubmissionDetailsForm from '~/components/submit/submission-details-form';
import SubmissionSummary from '~/components/submit/submission-summary';
import SubmissionPreview from '~/components/submit/submission-preview';
import RepositoryPicker from '~/components/submit/repository-picker';
import useSubmitFlow from '~/queries/submissions/use-submit-flow';
import { SidebarCard } from '~/components/addon/sidebar-card';
import { getSubmitStep } from '~/components/submit/submit-step';
import AddonPicker from '~/components/submit/addon-picker';
import SubmitSteps from '~/components/submit/submit-steps';
import type { PendingSource } from '~/lib/dashboard';
import GitHubIcon from '~/components/icons/github';
import { Button } from '~/components/ui/button';
import { Card } from '~/components/ui/card';

type SubmitFormProps = {
	githubLinked: boolean;
	/** The one addon this submission may be for; the listing's other addons stay disabled. */
	lockedAddonId?: string;
	pendingSource?: PendingSource;
	onSubmitted: (submission: Submission) => void;
};

type SubmitFlowProps = Omit<SubmitFormProps, 'githubLinked'>;

/** The sections in the main column, the steps and the summary in a sticky aside. */
function SubmitFlow({ lockedAddonId, pendingSource, onSubmitted }: SubmitFlowProps) {
	const flow = useSubmitFlow({ lockedAddonId, pendingSource, onSubmitted });
	const [activity, setActivity] = useState<SubmitActivity>('repository');
	const { listing, request, preview, isPending } = flow;
	const step = getSubmitStep(flow);
	const busy = isPending ? activity : null;

	return (
		<div className='items-start gap-6 grid lg:grid-cols-[1fr_380px]'>
			<div className='flex flex-col gap-6 min-w-0'>
				<RepositoryPicker
					defaultValue={pendingSource?.repository ?? ''}
					repositories={flow.repositories}
					disabled={isPending}
					busy={busy === 'repository'}
					error={step === 'repository' ? flow.error : null}
					onPick={(repository) => {
						setActivity('repository');
						flow.read({ repository });
					}}
				/>

				{listing ? (
					<AddonPicker
						key={`${listing.repository}@${listing.commitSha}`}
						listing={listing}
						lockedAddonId={lockedAddonId}
						selected={flow.path}
						disabled={isPending}
						busy={busy === 'ref' || busy === 'preview' ? busy : null}
						error={step === 'addon' ? flow.error : null}
						onRefChange={(ref) => {
							setActivity('ref');
							flow.read({ repository: listing.repository, ref });
						}}
						onPick={(addon) => {
							setActivity('preview');
							flow.pick(addon);
						}}
					/>
				) : null}

				{request && preview ? (
					<>
						<SubmissionPreview preview={preview} />
						<SubmissionDetailsForm
							key={`${request.repository}@${request.commitSha}/${request.path}`}
							preview={preview}
							error={flow.error}
							disabled={isPending}
							onSubmit={(details) => {
								setActivity('submit');
								flow.submit(details);
							}}
						/>
					</>
				) : null}
			</div>
			<aside className='lg:top-6 lg:sticky flex flex-col gap-6 min-w-0'>
				<SubmitSteps
					step={step}
					values={{ repository: listing?.repository, addon: preview?.manifest.id }}
				/>
				{preview ? (
					<SidebarCard title='Submission'>
						<SubmissionSummary preview={preview} />
					</SidebarCard>
				) : null}
			</aside>
		</div>
	);
}

function LinkGitHub() {
	return (
		<Card>
			<Empty>
				<EmptyHeader>
					<EmptyMedia variant='icon'>
						<GitHubIcon />
					</EmptyMedia>
					<EmptyTitle>Link GitHub to submit</EmptyTitle>
					<EmptyDescription>
						Addons are submitted from a public GitHub repository you can push to.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<Button asChild>
						<Link to='/account'>
							<GitHubIcon />
							Link GitHub
						</Link>
					</Button>
				</EmptyContent>
			</Empty>
		</Card>
	);
}

function SubmitForm({ githubLinked, ...props }: SubmitFormProps) {
	return githubLinked ? <SubmitFlow {...props} /> : <LinkGitHub />;
}

export default SubmitForm;
