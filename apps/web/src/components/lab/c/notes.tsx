import { IconNote, IconPen, IconTrash } from 'nucleo-micro-bold';
import type { Subject } from '@unbound-app/contracts/admin';
import { useMutation } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import { toast } from 'sonner';

import {
	createStaffNoteMutation,
	deleteStaffNoteMutation,
	editStaffNoteMutation,
} from '~/queries/staff-notes/staff-notes';
import getApiErrorMessage from '~/lib/api/error-message';
import ConfirmDialog from '~/components/confirm-dialog';
import type { StaffNote } from '~/lib/staff-notes';
import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import Text from '~/components/ui/text';

type NoteEditorProps = {
	initialBody: string;
	submitLabel: string;
	placeholder?: string;
	onSubmit: (body: string) => Promise<boolean>;
	onCancel: () => void;
};

type NoteComposerProps = {
	subject: Subject;
};

type NoteBodyProps = {
	subject: Subject;
	note: StaffNote;
	canWrite: boolean;
};

const MAX_LENGTH = 5000;

async function run<T>(action: Promise<T>, success: string): Promise<boolean> {
	try {
		await action;
	} catch (error) {
		toast.error(getApiErrorMessage(error));

		return false;
	}

	toast.success(success);

	return true;
}

function NoteEditor({
	initialBody,
	submitLabel,
	placeholder,
	onSubmit,
	onCancel,
}: NoteEditorProps) {
	const form = useForm({
		defaultValues: { body: initialBody },
		onSubmit: async ({ value, formApi }) => {
			if (await onSubmit(value.body)) {
				formApi.reset();
			}
		},
	});

	return (
		<form
			className='flex flex-col gap-2'
			onSubmit={(event) => {
				event.preventDefault();
				void form.handleSubmit();
			}}
		>
			<form.Field name='body'>
				{(field) => (
					<Textarea
						autoFocus
						value={field.state.value}
						onChange={(event) => field.handleChange(event.target.value)}
						onBlur={field.handleBlur}
						placeholder={placeholder}
						maxLength={MAX_LENGTH}
						aria-label='Note'
					/>
				)}
			</form.Field>
			<div className='flex justify-end gap-2'>
				<Button type='button' variant='ghost' size='sm' onClick={onCancel}>
					Cancel
				</Button>
				<form.Subscribe
					selector={(state) =>
						[state.values.body.trim() === '', state.isSubmitting] as const
					}
				>
					{([empty, submitting]) => (
						<Button type='submit' size='sm' disabled={empty || submitting}>
							{submitLabel}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

/**
 * @description A one-line "Add a staff note" button that opens into an editor.
 * @param props The subject the note is about.
 * @returns The button, or the open editor.
 */
export function NoteComposer({ subject }: NoteComposerProps) {
	const [open, setOpen] = useState(false);
	const create = useMutation(createStaffNoteMutation(subject));

	if (!open) {
		return (
			<Button variant='outline' size='sm' onClick={() => setOpen(true)}>
				<IconNote size={24} />
				Add staff note
			</Button>
		);
	}

	return (
		<div className='w-full'>
			<NoteEditor
				initialBody=''
				submitLabel='Add note'
				placeholder={`Only staff can see notes on this ${subject.type}.`}
				onSubmit={async (body) => {
					const added = await run(create.mutateAsync(body), 'Note added.');

					if (added) {
						setOpen(false);
					}

					return added;
				}}
				onCancel={() => setOpen(false)}
			/>
		</div>
	);
}

/**
 * @description A staff note's text, with Edit and Delete for its author.
 * @param props The subject, the note and whether the viewer may write notes.
 * @returns The note, or its editor.
 */
export function NoteBody({ subject, note, canWrite }: NoteBodyProps) {
	const [editing, setEditing] = useState(false);
	const edit = useMutation(editStaffNoteMutation(subject));
	const remove = useMutation(deleteStaffNoteMutation(subject));

	if (editing) {
		return (
			<NoteEditor
				initialBody={note.body}
				submitLabel='Save note'
				onSubmit={async (body) => {
					const saved = await run(edit.mutateAsync({ id: note.id, body }), 'Note saved.');

					if (saved) {
						setEditing(false);
					}

					return saved;
				}}
				onCancel={() => setEditing(false)}
			/>
		);
	}

	return (
		<div className='flex flex-col gap-2'>
			<Text
				variant='text-sm'
				className='bg-muted/50 px-3 py-2 rounded-control break-words whitespace-pre-wrap'
			>
				{note.body}
			</Text>
			{canWrite && note.mine ? (
				<div className='flex gap-1 -ml-2'>
					<Button
						variant='ghost'
						size='sm'
						className='px-2 h-7 text-muted-foreground hover:text-foreground'
						onClick={() => setEditing(true)}
					>
						<IconPen size={24} />
						Edit
					</Button>
					<ConfirmDialog
						trigger={
							<Button
								variant='ghost'
								size='sm'
								className='px-2 h-7 text-muted-foreground hover:text-foreground'
								disabled={remove.isPending}
							>
								<IconTrash size={24} />
								Delete
							</Button>
						}
						title='Delete this note?'
						description='It is removed for every staff member. This cannot be undone.'
						confirmLabel='Delete Note'
						onConfirm={() => void run(remove.mutateAsync(note.id), 'Note deleted.')}
					/>
				</div>
			) : null}
		</div>
	);
}

export default { NoteComposer, NoteBody };
