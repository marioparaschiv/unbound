import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import type { Submission } from '@unbound-app/contracts/publish';
import { useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

import { submitOverviewQuery } from '~/queries/submissions/submissions';
import SubmitForm from '~/components/submit/submit-form';
import PageHeader from '~/components/page-header';

function SubmitAddonPage() {
	const {
		data: { githubLinked },
	} = useSuspenseQuery(submitOverviewQuery());
	const navigate = useNavigate();

	async function handleSubmitted(submission: Submission) {
		toast.success(`Submitted ${submission.addonId} ${submission.version} for review`);
		await navigate({ to: '/dashboard' });
	}

	return (
		<div className='flex flex-col gap-6 page-frame'>
			<PageHeader
				title='Submit Addon'
				description='Submit a new addon or an update from GitHub. Reviewers see exactly the files at the commit you pick.'
			/>

			<SubmitForm githubLinked={githubLinked} onSubmitted={handleSubmitted} />
		</div>
	);
}

export const Route = createFileRoute('/_site/submit')({
	head: () => ({ meta: [{ title: 'Unbound | Submit Addon' }] }),
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: '/login' });
		}
	},
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(submitOverviewQuery());
	},
	component: SubmitAddonPage,
});
