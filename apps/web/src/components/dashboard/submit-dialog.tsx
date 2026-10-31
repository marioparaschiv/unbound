import type { Submission } from '@unbound-app/contracts/publish';
import { IconRefresh, IconUpload } from 'nucleo-micro-bold';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import { repositoryAddonsQuery } from '~/queries/submissions/submissions';
import type { PendingSource, SubmitIntent } from '~/lib/dashboard';
import usePrefetchIntent from '~/queries/use-prefetch-intent';
import SubmitForm from '~/components/submit/submit-form';
import { Button } from '~/components/ui/button';

type SubmitDialogProps = {
	addonId: string;
	intent: SubmitIntent;
	githubLinked: boolean;
	source?: PendingSource | null;
	variant?: 'default' | 'outline';
};

type IntentCopy = {
	label: string;
	icon: ReactNode;
	description: string;
};

const INTENTS: Record<SubmitIntent, IntentCopy> = {
	republish: {
		label: 'Republish',
		icon: <IconRefresh size={24} />,
		description:
			'Push the changes, then pick the commit that has them. The new submission replaces the one with changes requested and goes back into the review queue.',
	},
	update: {
		label: 'Submit update',
		icon: <IconUpload size={24} />,
		description:
			'Pick the commit with the new version. The live version stays until reviewers approve it.',
	},
};

function SubmitDialog({
	addonId,
	intent,
	githubLinked,
	source,
	variant = 'default',
}: SubmitDialogProps) {
	const [open, setOpen] = useState(false);
	const copy = INTENTS[intent];
	// The form reads the last submission's repository as it opens, the slowest thing the dialog waits on.
	const prefetch = usePrefetchIntent(
		repositoryAddonsQuery(source && githubLinked ? { repository: source.repository } : null),
	);

	function handleSubmitted(submitted: Submission) {
		setOpen(false);
		toast.success(`Submitted ${submitted.addonId} ${submitted.version} for review`);
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant={variant} size='sm' {...prefetch}>
					{copy.icon}
					{copy.label}
				</Button>
			</DialogTrigger>
			<DialogContent className='max-w-xl'>
				<DialogHeader>
					<DialogTitle>
						{copy.label}: {addonId}
					</DialogTitle>
					<DialogDescription>{copy.description}</DialogDescription>
				</DialogHeader>
				<SubmitForm
					githubLinked={githubLinked}
					lockedAddonId={addonId}
					pendingSource={source ?? undefined}
					onSubmitted={handleSubmitted}
				/>
			</DialogContent>
		</Dialog>
	);
}

export default SubmitDialog;
