import type { Submission } from '@unbound-app/contracts/publish';
import { Link } from '@tanstack/react-router';

import SubmissionDetailsForm from '~/components/submit/submission-details-form';
import SubmissionPreview from '~/components/submit/submission-preview';
import RepositoryPicker from '~/components/submit/repository-picker';
import useSubmitFlow from '~/queries/submissions/use-submit-flow';
import AddonPicker from '~/components/submit/addon-picker';
import type { PendingSource } from '~/lib/dashboard';
import GitHubIcon from '~/components/icons/github';
import { FieldError } from '~/components/ui/field';
import { Button } from '~/components/ui/button';
import Text from '~/components/ui/text';

type SubmitFormProps = {
	githubLinked: boolean;
	lockedAddonId?: string;
	pendingSource?: PendingSource;
	onSubmitted: (submission: Submission) => void;
};

type SubmitFlowProps = Omit<SubmitFormProps, 'githubLinked'>;

function SubmitFlow({ lockedAddonId, pendingSource, onSubmitted }: SubmitFlowProps) {
	const flow = useSubmitFlow({ pendingSource, onSubmitted });
	const { listing, request, preview, isPending } = flow;

	return (
		<div className='flex flex-col gap-6'>
			<RepositoryPicker
				defaultValue={pendingSource?.repository ?? ''}
				repositories={flow.repositories}
				disabled={isPending}
				onPick={(repository) => flow.read({ repository })}
			/>

			{listing ? (
				<AddonPicker
					key={`${listing.repository}@${listing.commitSha}`}
					listing={listing}
					lockedAddonId={lockedAddonId}
					selected={flow.path}
					disabled={isPending}
					onRefChange={(ref) => flow.read({ repository: listing.repository, ref })}
					onPick={flow.pick}
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
						onSubmit={flow.submit}
					/>
				</>
			) : (
				<FieldError className='whitespace-pre-wrap'>{flow.error}</FieldError>
			)}
		</div>
	);
}

function SubmitForm({ githubLinked, ...props }: SubmitFormProps) {
	if (!githubLinked) {
		return (
			<div className='flex flex-col items-start gap-3'>
				<Text variant='text-sm' color='muted'>
					Addons are submitted from a public GitHub repository you can push to. Link your
					GitHub account first.
				</Text>
				<Button asChild variant='outline'>
					<Link to='/account'>
						<GitHubIcon />
						Link GitHub
					</Link>
				</Button>
			</div>
		);
	}

	return <SubmitFlow {...props} />;
}

export default SubmitForm;
