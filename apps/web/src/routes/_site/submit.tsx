import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import type { Submission } from '@unbound-app/contracts/publish';
import { toast } from 'sonner';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card';
import SubmitForm from '~/components/submit/submit-form';
import { getSubmitOverview } from '~/lib/publishing';
import Text from '~/components/ui/text';

function SubmitAddonPage() {
	const { githubLinked } = Route.useLoaderData();
	const navigate = useNavigate();

	async function handleSubmitted(submission: Submission) {
		toast.success(`Submitted ${submission.addonId} ${submission.version} for review`);
		await navigate({ to: '/dashboard' });
	}

	return (
		<div className='flex flex-col gap-6 mb-12 page-frame'>
			<div className='flex flex-col gap-2'>
				<Text variant='heading-lg'>Submit Addon</Text>
				<Text variant='text-md' color='muted'>
					Submit a new theme or plugin, or an update to one you maintain, for review. This
					is the same flow as ubd publish: reviewers see exactly the files at the commit
					you pick.
				</Text>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>From GitHub</CardTitle>
					<CardDescription>
						Pick a repository, then the addon and the commit to submit. Its built bundle
						must be committed.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<SubmitForm githubLinked={githubLinked} onSubmitted={handleSubmitted} />
				</CardContent>
			</Card>
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
	loader: () => getSubmitOverview(),
	component: SubmitAddonPage,
});
