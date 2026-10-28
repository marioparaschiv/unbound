import { IconNote, IconPen, IconTrash } from 'nucleo-micro-bold';
import type { Subject } from '@unbound-app/contracts/admin';
import { Link, useRouter } from '@tanstack/react-router';
import { useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';

import { createStaffNoteFn, deleteStaffNoteFn, editStaffNoteFn } from '~/lib/admin-functions';
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

type Run = (action: () => Promise<void>, success: string) => Promise<boolean>;

type NoteComposerProps = {
	subject: Subject;
	disabled: boolean;
	run: Run;
};

type NoteItemProps = {
	note: StaffNote;
	canWrite: boolean;
	disabled: boolean;
	run: Run;
};

type NoteEditorProps = {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
	disabled: boolean;
	submitLabel: string;
	placeholder?: string;
	onCancel?: () => void;
};

const MAX_LENGTH = 5000;

function NoteEditor({
	value,
	onChange,
	onSubmit,
	disabled,
	submitLabel,
	placeholder,
	onCancel,
}: NoteEditorProps) {
	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		onSubmit();
	}

	return (
		<form onSubmit={submit} className='flex flex-col gap-2'>
			<Textarea
				value={value}
				onChange={(event) => onChange(event.target.value)}
				placeholder={placeholder}
				maxLength={MAX_LENGTH}
				aria-label='Note'
				disabled={disabled}
			/>
			<div className='flex justify-end gap-2'>
				{onCancel ? (
					<Button type='button' variant='ghost' size='sm' onClick={onCancel}>
						Cancel
					</Button>
				) : null}
				<Button type='submit' size='sm' disabled={disabled || value.trim() === ''}>
					{submitLabel}
				</Button>
			</div>
		</form>
	);
}

function NoteComposer({ subject, disabled, run }: NoteComposerProps) {
	const [body, setBody] = useState('');

	async function create() {
		const created = await run(async () => {
			await createStaffNoteFn({ data: { subject, body } });
		}, 'Note added');

		if (created) {
			setBody('');
		}
	}

	return (
		<Card className='p-(--card-pad)'>
			<NoteEditor
				value={body}
				onChange={setBody}
				onSubmit={create}
				disabled={disabled}
				submitLabel='Add Note'
				placeholder={`Only staff can see notes on this ${subject.type}.`}
			/>
		</Card>
	);
}

function NoteItem({ note, canWrite, disabled, run }: NoteItemProps) {
	const [draft, setDraft] = useState<string | null>(null);

	async function save() {
		if (draft === null) return;

		const saved = await run(async () => {
			await editStaffNoteFn({ data: { id: note.id, body: draft } });
		}, 'Note saved');

		if (saved) {
			setDraft(null);
		}
	}

	function remove() {
		void run(async () => {
			await deleteStaffNoteFn({ data: { id: note.id } });
		}, 'Note deleted');
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
					{canWrite && note.mine && draft === null ? (
						<div className='flex gap-1'>
							<Button
								variant='ghost'
								size='icon-sm'
								aria-label='Edit note'
								disabled={disabled}
								onClick={() => setDraft(note.body)}
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
								onConfirm={remove}
							/>
						</div>
					) : null}
				</div>
				{draft === null ? (
					<Text variant='text-sm' className='break-words whitespace-pre-wrap'>
						{note.body}
					</Text>
				) : (
					<NoteEditor
						value={draft}
						onChange={setDraft}
						onSubmit={save}
						onCancel={() => setDraft(null)}
						disabled={disabled}
						submitLabel='Save'
					/>
				)}
			</div>
		</li>
	);
}

function StaffNotes({ subject, notes, canWrite }: StaffNotesProps) {
	const router = useRouter();
	const [isPending, startTransition] = useTransition();

	function run(action: () => Promise<void>, success: string): Promise<boolean> {
		return new Promise((resolve) => {
			startTransition(async () => {
				try {
					await action();
				} catch (error) {
					toast.error(getApiErrorMessage(error));
					resolve(false);

					return;
				}

				await router.invalidate();
				toast.success(success);
				resolve(true);
			});
		});
	}

	return (
		<div className='flex flex-col gap-3'>
			{canWrite ? <NoteComposer subject={subject} disabled={isPending} run={run} /> : null}
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
								run={run}
							/>
						))}
					</ol>
				</Card>
			)}
		</div>
	);
}

export default StaffNotes;
