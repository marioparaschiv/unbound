import type { Submission } from '@unbound-app/contracts/publish';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { useState } from 'react';

import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '~/components/ui/empty';
import {
	SubmitSection,
	SubmitSurface,
	SubmitVariantContext,
} from '~/components/submit/submit-section';
import type { SubmitActivity, SubmitStep } from '~/components/submit/submit-step';
import SubmissionDetailsForm from '~/components/submit/submission-details-form';
import SubmissionSummary from '~/components/submit/submission-summary';
import SubmissionPreview from '~/components/submit/submission-preview';
import type { SubmitVariant } from '~/components/submit/submit-section';
import RepositoryPicker from '~/components/submit/repository-picker';
import useSubmitFlow from '~/queries/submissions/use-submit-flow';
import { SidebarCard } from '~/components/addon/sidebar-card';
import { getSubmitStep } from '~/components/submit/submit-step';
import AddonPicker from '~/components/submit/addon-picker';
import SubmitSteps from '~/components/submit/submit-steps';
import type { PendingSource } from '~/lib/dashboard';
import GitHubIcon from '~/components/icons/github';
import { Button } from '~/components/ui/button';

type SubmitFormProps = {
	githubLinked: boolean;
	lockedAddonId?: string;
	pendingSource?: PendingSource;
	/** `page` lays the sections out as cards beside a summary; `dialog` stacks them bare. */
	variant?: SubmitVariant;
	onSubmitted: (submission: Submission) => void;
};

type SubmitFlowProps = Omit<SubmitFormProps, 'githubLinked'>;

type SubmitLayoutProps = {
	step: SubmitStep;
	stepValues: Partial<Record<SubmitStep, string>>;
	/** The repository, addon and preview sections. */
	sections: ReactNode;
	/** The picked addon's facts, once it has a preview. */
	summary: ReactNode;
	details: ReactNode;
};

/** Page: the sections in the main column, the steps and the summary in a sticky aside. */
function PageLayout({ step, stepValues, sections, summary, details }: SubmitLayoutProps) {
	return (
		<div className='items-start gap-6 grid lg:grid-cols-[1fr_380px]'>
			<div className='flex flex-col gap-6 min-w-0'>
				{sections}
				{details}
			</div>
			<aside className='lg:top-6 lg:sticky flex flex-col gap-6 min-w-0'>
				<SubmitSteps step={step} values={stepValues} />
				{summary ? <SidebarCard title='Submission'>{summary}</SidebarCard> : null}
			</aside>
		</div>
	);
}

/** Dialog: one column, the summary inline above the details. */
function DialogLayout({ sections, summary, details }: SubmitLayoutProps) {
	return (
		<div className='flex flex-col gap-6 min-w-0'>
			{sections}
			{summary ? <SubmitSection title='Submission'>{summary}</SubmitSection> : null}
			{details}
		</div>
	);
}

const LAYOUTS: Record<SubmitVariant, (props: SubmitLayoutProps) => ReactNode> = {
	page: PageLayout,
	dialog: DialogLayout,
};

function SubmitFlow({
	lockedAddonId,
	pendingSource,
	variant = 'page',
	onSubmitted,
}: SubmitFlowProps) {
	const flow = useSubmitFlow({ pendingSource, onSubmitted });
	const [activity, setActivity] = useState<SubmitActivity>('repository');
	const { listing, request, preview, isPending } = flow;
	const step = getSubmitStep(flow);
	const busy = isPending ? activity : null;
	const Layout = LAYOUTS[variant];

	return (
		<Layout
			step={step}
			stepValues={{ repository: listing?.repository, addon: preview?.manifest.id }}
			summary={preview ? <SubmissionSummary preview={preview} /> : null}
			details={
				request && preview ? (
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
				) : null
			}
			sections={
				<>
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

					{request && preview ? <SubmissionPreview preview={preview} /> : null}
				</>
			}
		/>
	);
}

function LinkGitHub() {
	return (
		<SubmitSurface>
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
		</SubmitSurface>
	);
}

function SubmitForm({ githubLinked, variant = 'page', ...props }: SubmitFormProps) {
	return (
		<SubmitVariantContext.Provider value={variant}>
			{githubLinked ? <SubmitFlow variant={variant} {...props} /> : <LinkGitHub />}
		</SubmitVariantContext.Provider>
	);
}

export default SubmitForm;
