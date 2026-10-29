import { IconNote, IconPen, IconTrash } from 'nucleo-micro-bold';
import type { Subject } from '@unbound-app/contracts/admin';
import { useMutation } from '@tanstack/react-query';
import { useForm } from '@tanstack/react-form';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { toast } from 'sonner';

import {
	createStaffNoteMutation,
	deleteStaffNoteMutation,
	editStaffNoteMutation,
} from '~/queries/staff-notes/staff-notes';
import { formatDateTime } from '~/components/admin/format-date';
import getApiErrorMessage from '~/lib/api/error-message';
import ConfirmDialog from '~/components/confirm-dialog';
import type { StaffNote } from '~/lib/staff-notes';
import UserAvatar from '~/components/user-avatar';
import { Button } from '~/components/ui/button';
import Textarea from '~/components/ui/textarea';
import { Card } from '~/components/ui/card';
import Text from '~/components/ui/text';

type StaffNotesProps = {
	subject: Subject;
	/** Newest first. */
	notes: StaffNote[];
	canWrite: boolean;
};

type NoteItemProps = {
	note: StaffNote;
	canWrite: boolean;
	disabled: boolean;
	onSave: (id: number, body: string) => Promise<boolean>;
	onDelete: (id: number) => void;
};

type NoteEditorProps = {
	initialBody: string;
	onSubmit: (body: string) => Promise<boolean>;
	disabled: boolean;
	submitLabel: string;
	placeholder?: string;
	onCancel?: () => void;
};

const MAX_LENGTH = 5000;

function NoteEditor({
	initialBody,
	onSubmit,
	disabled,
	submitLabel,
	placeholder,
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
						value={field.state.value}
						onChange={(event) => field.handleChange(event.target.value)}
						onBlur={field.handleBlur}
						placeholder={placeholder}
						maxLength={MAX_LENGTH}
						aria-label='Note'
						disabled={disabled}
					/>
				)}
			</form.Field>
			<div className='flex justify-end gap-2'>
				{onCancel ? (
					<Button type='button' variant='ghost' size='sm' onClick={onCancel}>
						Cancel
					</Button>
				) : null}
				<form.Subscribe selector={(state) => state.values.body.trim() === ''}>
					{(empty) => (
						<Button type='submit' size='sm' disabled={disabled || empty}>
							{submitLabel}
						</Button>
					)}
				</form.Subscribe>
			</div>
		</form>
	);
}

function NoteItem({ note, canWrite, disabled, onSave, onDelete }: NoteItemProps) {
	const [editing, setEditing] = useState(false);

	async function save(body: string) {
		const saved = await onSave(note.id, body);

		if (saved) {
			setEditing(false);
		}

		return saved;
	}

	return (
		<li className='flex gap-3 p-(--card-pad)'>
			<UserAvatar
				src={note.author?.image ?? null}
				name={note.author?.name ?? '?'}
				size='sm'
			/>
			<div className='flex flex-col flex-1 gap-1.5 min-w-0'>
				<div className='flex flex-wrap justify-between items-center gap-2'>
					<Text variant='text-sm' color='muted'>
						{note.author ? (
							<Link
								to='/admin/users/$id'
								params={{ id: note.author.id }}
								className='font-medium text-foreground hover:underline'
							>
								{note.author.name}
							</Link>
						) : (
							<span className='font-medium text-foreground'>A deleted user</span>
						)}{' '}
						· {formatDateTime(note.createdAt)}
						{note.editedAt ? ` · edited ${formatDateTime(note.editedAt)}` : null}
					</Text>
					{canWrite && note.mine && !editing ? (
						<div className='flex gap-1'>
							<Button
								variant='ghost'
								size='icon-sm'
								aria-label='Edit note'
								disabled={disabled}
								onClick={() => setEditing(true)}
							>
								<IconPen size={24} />
							</Button>
							<ConfirmDialog
								trigger={
									<Button
										variant='ghost'
										size='icon-sm'
										aria-label='Delete note'
										disabled={disabled}
									>
										<IconTrash size={24} />
									</Button>
								}
								title='Delete this note?'
								description='It is removed for every staff member. This cannot be undone.'
								confirmLabel='Delete Note'
								onConfirm={() => onDelete(note.id)}
							/>
						</div>
					) : null}
				</div>
				{editing ? (
					<NoteEditor
						initialBody={note.body}
						onSubmit={save}
						onCancel={() => setEditing(false)}
						disabled={disabled}
						submitLabel='Save'
					/>
				) : (
					<Text variant='text-sm' className='break-words whitespace-pre-wrap'>
						{note.body}
					</Text>
				)}
			</div>
		</li>
	);
}

function StaffNotes({ subject, notes, canWrite }: StaffNotesProps) {
	const create = useMutation(createStaffNoteMutation(subject));
	const edit = useMutation(editStaffNoteMutation(subject));
	const remove = useMutation(deleteStaffNoteMutation(subject));
	const isPending = create.isPending || edit.isPending || remove.isPending;

	// `mutateAsync` resolves after `onSuccess` has refetched the subject, so the toast lands with the new notes.
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

	return (
		<div className='flex flex-col gap-3'>
			{canWrite ? (
				<Card className='p-(--card-pad)'>
					<NoteEditor
						initialBody=''
						onSubmit={(body) => run(create.mutateAsync(body), 'Note added')}
						disabled={isPending}
						submitLabel='Add Note'
						placeholder={`Only staff can see notes on this ${subject.type}.`}
					/>
				</Card>
			) : null}
			{notes.length === 0 ? (
				<Card className='flex-row items-center gap-2 p-(--card-pad)'>
					<IconNote className='size-4 text-muted-foreground' />
					<Text variant='text-sm' color='muted'>
						No staff notes yet.
					</Text>
				</Card>
			) : (
				<Card className='gap-0 p-0'>
					<ol className='flex flex-col divide-y divide-border'>
						{notes.map((note) => (
							<NoteItem
								key={note.id}
								note={note}
								canWrite={canWrite}
								disabled={isPending}
								onSave={(id, body) =>
									run(edit.mutateAsync({ id, body }), 'Note saved')
								}
								onDelete={(id) => void run(remove.mutateAsync(id), 'Note deleted')}
							/>
						))}
					</ol>
				</Card>
			)}
		</div>
	);
}

export default StaffNotes;
