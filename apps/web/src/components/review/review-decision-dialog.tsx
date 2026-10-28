import { reviewSubmissionResponseSchema } from '@unbound-app/contracts/review';
import type { ReviewDecision } from '@unbound-app/contracts/publish';
import { IconCheck, IconMsg, IconXmark } from 'nucleo-micro-bold';
import { useId, useState, useTransition } from 'react';
import { useRouter } from '@tanstack/react-router';
import type { FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '~/components/ui/dialog';
import { createBrowserClient } from '~/lib/api/browser-client';
import type { ButtonProps } from '~/components/ui/button';
import getApiErrorMessage from '~/lib/api/error-message';
import type { ReviewEntry } from '~/lib/review-entry';
import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import Label from '~/components/ui/label';

type ReviewDecisionDialogProps = {
	entry: ReviewEntry;
	decision: ReviewDecision;
};

type DecisionCopy = {
	label: string;
	icon: ReactNode;
	variant: ButtonProps['variant'];
	description: string;
	noteLabel: string;
	placeholder: string;
	done: string;
};

const DECISIONS: Record<ReviewDecision, DecisionCopy> = {
	approved: {
		label: 'Approve',
		icon: <IconCheck size={24} />,
		variant: 'default',
		description:
			'This publishes exactly the staged bundle. A new listing makes its submitter the owner.',
		noteLabel: 'Note (optional)',
		placeholder: 'Anything the author should know...',
		done: 'Approved',
	},
	rejected: {
		label: 'Reject',
		icon: <IconXmark size={24} />,
		variant: 'destructive',
		description: 'This deletes the staged bundle. A rejected new listing frees its addon id.',
		noteLabel: 'Reason',
		placeholder: 'Explain why this submission is rejected...',
		done: 'Rejected',
	},
	changes_requested: {
		label: 'Request Changes',
		icon: <IconMsg size={24} />,
		variant: 'outline',
		description: 'The submission leaves the queue until the author publishes again.',
		noteLabel: 'Requested changes',
		placeholder: 'Describe what the author must change...',
		done: 'Requested changes on',
	},
};

function ReviewDecisionDialog({ entry, decision }: ReviewDecisionDialogProps) {
	const router = useRouter();
	const noteId = useId();
	const [open, setOpen] = useState(false);
	const [note, setNote] = useState('');
	const [isPending, startTransition] = useTransition();
	const copy = DECISIONS[decision];
	const { submission } = entry;
	const title = `${entry.name} ${submission.version}`;
	const trimmed = note.trim();
	const noteRequired = decision !== 'approved';

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		const body =
			decision === 'approved'
				? { decision, note: trimmed || undefined }
				: { decision, note: trimmed };

		startTransition(async () => {
			try {
				await createBrowserClient()('POST /api/v1/submissions/$id/review', {
					params: { id: submission.id },
					body,
					response: reviewSubmissionResponseSchema,
				});
			} catch (error) {
				toast.error(getApiErrorMessage(error));

				return;
			}

			setOpen(false);
			setNote('');
			await router.invalidate();
			toast.success(`${copy.done} ${title}`);
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant={copy.variant}>
					{copy.icon}
					{copy.label}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form onSubmit={submit} className='flex flex-col gap-4'>
					<DialogHeader>
						<DialogTitle>
							{copy.label} {title}?
						</DialogTitle>
						<DialogDescription>{copy.description}</DialogDescription>
					</DialogHeader>
					<div className='flex flex-col gap-2'>
						<Label htmlFor={noteId}>{copy.noteLabel}</Label>
						<Textarea
							id={noteId}
							value={note}
							onChange={(event) => setNote(event.target.value)}
							placeholder={copy.placeholder}
							required={noteRequired}
							disabled={isPending}
						/>
					</div>
					<DialogFooter>
						<Button
							type='button'
							variant='outline'
							onClick={() => setOpen(false)}
							disabled={isPending}
						>
							Cancel
						</Button>
						<Button
							type='submit'
							variant={copy.variant}
							disabled={isPending || (noteRequired && !trimmed)}
						>
							{copy.icon}
							{copy.label}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default ReviewDecisionDialog;
