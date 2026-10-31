import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router';
import type { Submission } from '@unbound-app/contracts/publish';
import { useSuspenseQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { z } from 'zod/mini';

import { repositoryAddonsQuery, submitOverviewQuery } from '~/queries/submissions/submissions';
import SubmitForm from '~/components/submit/submit-form';
import type { SubmitIntent } from '~/lib/dashboard';
import PageHeader from '~/components/page-header';
import Text from '~/components/ui/text';

type HeaderCopy = {
	title: string;
	description: string;
};

const submitSearchSchema = z.object({
	/** The addon to submit an update or republish for, as the dashboard's submit buttons link it. */
	addon: z.catch(z.optional(z.string().check(z.minLength(1), z.maxLength(100))), undefined),
});

const NEW_SUBMISSION: HeaderCopy = {
	title: 'Submit Addon',
	description:
		'Submit a new addon or an update from GitHub. Reviewers see exactly the files at the commit you pick.',
};

const HEADERS: Record<SubmitIntent, HeaderCopy> = {
	update: {
		title: 'Submit Update',
		description:
			'Pick the commit with the new version. The live version stays until reviewers approve it.',
	},
	republish: {
		title: 'Republish',
		description:
			'Push the changes, then pick the commit that has them. The new submission replaces the one with changes requested and goes back into the review queue.',
	},
};

function SubmitAddonPage() {
	const { addon } = Route.useSearch();
	const {
		data: { githubLinked, target },
	} = useSuspenseQuery(submitOverviewQuery(addon));
	const navigate = useNavigate();
	const header = target ? HEADERS[target.intent] : NEW_SUBMISSION;

	async function handleSubmitted(submission: Submission) {
		toast.success(`Submitted ${submission.addonId} ${submission.version} for review`);
		await navigate({ to: '/dashboard' });
	}

	return (
		<div className='flex flex-col gap-6 page-frame'>
			<PageHeader
				title={header.title}
				description={
					target ? (
						<>
							<span className='font-mono text-foreground'>{target.addonId}</span> ·{' '}
							{header.description}
						</>
					) : (
						header.description
					)
				}
			/>

			{addon && !target ? (
				<Text variant='text-sm' color='muted' className='-mt-4'>
					You cannot submit for <span className='font-mono'>{addon}</span> right now, so
					this is a new submission.
				</Text>
			) : null}

			<SubmitForm
				key={target?.addonId}
				githubLinked={githubLinked}
				lockedAddonId={target?.addonId}
				pendingSource={target?.source ?? undefined}
				onSubmitted={handleSubmitted}
			/>
		</div>
	);
}

export const Route = createFileRoute('/_site/submit')({
	validateSearch: submitSearchSchema,
	head: () => ({ meta: [{ title: 'Unbound | Submit Addon' }] }),
	beforeLoad: ({ context }) => {
		if (!context.session) {
			throw redirect({ to: '/login' });
		}
	},
	loaderDeps: ({ search }) => ({ addon: search.addon }),
	loader: async ({ context, deps, preload }) => {
		const { githubLinked, target } = await context.queryClient.ensureQueryData(
			submitOverviewQuery(deps.addon),
		);

		// Hovering a dashboard submit button also reads the repository the page opens on; only the browser preloads.
		if (preload && githubLinked && target?.source) {
			void context.queryClient.prefetchQuery(
				repositoryAddonsQuery({ repository: target.source.repository }),
			);
		}
	},
	component: SubmitAddonPage,
});
