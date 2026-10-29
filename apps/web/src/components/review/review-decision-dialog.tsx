import type { ReviewDecision } from '@unbound-app/contracts/publish';
import { IconCheck, IconMsg, IconXmark } from 'nucleo-micro-bold';
import { useMutation } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { useId, useState } from 'react';
import type { ReactNode } from 'react';
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
import { reviewDecisionMutation } from '~/queries/review/review';
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
	const noteId = useId();
	const [open, setOpen] = useState(false);
	const copy = DECISIONS[decision];
	const { submission } = entry;
	const title = `${entry.name} ${submission.version}`;
	const noteRequired = decision !== 'approved';
	const { mutate, isPending } = useMutation(reviewDecisionMutation(submission.id));
	const form = useForm({
		defaultValues: { note: '' },
		onSubmit: ({ value }) => {
			const note = value.note.trim();
			const body =
				decision === 'approved'
					? { decision, note: note || undefined }
					: { decision, note };

			mutate(body, {
				onSuccess: () => {
					setOpen(false);
					form.reset();
					toast.success(`${copy.done} ${title}`);
				},
				onError: (error) => toast.error(getApiErrorMessage(error)),
			});
		},
	});

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant={copy.variant}>
					{copy.icon}
					{copy.label}
				</Button>
			</DialogTrigger>
			<DialogContent>
				<form
					onSubmit={(event) => {
						event.preventDefault();
						void form.handleSubmit();
					}}
					className='flex flex-col gap-4'
				>
					<DialogHeader>
						<DialogTitle>
							{copy.label} {title}?
						</DialogTitle>
						<DialogDescription>{copy.description}</DialogDescription>
					</DialogHeader>
					<div className='flex flex-col gap-2'>
						<Label htmlFor={noteId}>{copy.noteLabel}</Label>
						<form.Field name='note'>
							{(field) => (
								<Textarea
									id={noteId}
									value={field.state.value}
									onChange={(event) => field.handleChange(event.target.value)}
									onBlur={field.handleBlur}
									placeholder={copy.placeholder}
									required={noteRequired}
									disabled={isPending}
								/>
							)}
						</form.Field>
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
						<form.Subscribe selector={(state) => state.values.note.trim()}>
							{(note) => (
								<Button
									type='submit'
									variant={copy.variant}
									disabled={isPending || (noteRequired && !note)}
								>
									{copy.icon}
									{copy.label}
								</Button>
							)}
						</form.Subscribe>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

export default ReviewDecisionDialog;
