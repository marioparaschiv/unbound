import type {
	CreateStaffNoteRequest,
	DeleteStaffNoteRequest,
	EditStaffNoteRequest,
	Subject,
} from '@unbound-app/contracts/admin';
import type { UserSummary } from '@unbound-app/contracts/account';
import { and, eq } from 'drizzle-orm';

import { requirePermission } from '~/lib/api/caller';
import type { AppContext } from '~/lib/context';
import type { Caller } from '~/lib/api/caller';
import { ApiError } from '~/lib/api/errors';
import { staffNote } from '~/db/schema';

export type StaffNote = {
	id: number;
	/** `null` once the author is deleted. */
	author: UserSummary | null;
	body: string;
	createdAt: Date;
	/** When the author last edited it; `null` if never. */
	editedAt: Date | null;
	/** Whether the caller wrote it, so may edit and delete it. */
	mine: boolean;
};

type NoteRow = typeof staffNote.$inferSelect;

type NoteWithAuthor = NoteRow & { author: UserSummary | null };

const SUBJECT_COLUMNS = { user: 'userId', addon: 'addonId' } as const;

function toStaffNote(row: NoteWithAuthor, caller: Caller): StaffNote {
	return {
		id: row.id,
		author: row.author,
		body: row.body,
		createdAt: row.createdAt,
		editedAt: row.editedAt,
		mine: row.authorId === caller.user.id,
	};
}

function callerSummary(caller: Caller): UserSummary {
	return { id: caller.user.id, name: caller.user.name, image: caller.user.image ?? null };
}

async function subjectExists(ctx: AppContext, subject: Subject): Promise<boolean> {
	const where = { where: { id: subject.id }, columns: { id: true } } as const;
	const row =
		subject.type === 'user'
			? await ctx.db.query.user.findFirst(where)
			: await ctx.db.query.addon.findFirst(where);

	return Boolean(row);
}

/**
 * @description Builds the one statement behind {@link listStaffNotes}: a subject's notes, newest
 * first, with their authors.
 * @param ctx The application context.
 * @param subject The user or addon.
 * @returns The unexecuted relational query.
 */
export function queryStaffNotes(ctx: AppContext, subject: Subject) {
	return ctx.db.query.staffNote.findMany({
		where: { [SUBJECT_COLUMNS[subject.type]]: subject.id },
		with: { author: { columns: { id: true, name: true, image: true } } },
		orderBy: { id: 'desc' },
	});
}

/**
 * @description Lists the staff notes on a user or addon, newest first. Requires `note:read`.
 * @param ctx The application context.
 * @param caller The staff member.
 * @param subject The user or addon.
 * @returns The notes, each marked `mine` when the caller wrote it.
 */
export async function listStaffNotes(
	ctx: AppContext,
	caller: Caller,
	subject: Subject,
): Promise<StaffNote[]> {
	requirePermission(caller, { note: ['read'] });

	const rows = await queryStaffNotes(ctx, subject);

	return rows.map((row) => toStaffNote(row, caller));
}

/**
 * @description Writes a note on a user or addon as the caller. Requires `note:write`.
 * @param ctx The application context.
 * @param caller The staff member.
 * @param request The subject and the note's body.
 * @returns The new note.
 */
export async function createStaffNote(
	ctx: AppContext,
	caller: Caller,
	request: CreateStaffNoteRequest,
): Promise<StaffNote> {
	requirePermission(caller, { note: ['write'] });

	const { subject, body } = request;

	if (!(await subjectExists(ctx, subject))) {
		throw new ApiError('not_found', `No ${subject.type} has the id ${subject.id}.`);
	}

	const row = ctx.db
		.insert(staffNote)
		.values({
			userId: subject.type === 'user' ? subject.id : null,
			addonId: subject.type === 'addon' ? subject.id : null,
			authorId: caller.user.id,
			body,
			createdAt: ctx.now(),
		})
		.returning()
		.get();

	return toStaffNote({ ...row, author: callerSummary(caller) }, caller);
}

async function failMissingOwnNote(ctx: AppContext, id: number): Promise<never> {
	const row = await ctx.db.query.staffNote.findFirst({ where: { id }, columns: { id: true } });

	if (row) {
		throw new ApiError('forbidden', 'Only its author can change a note.');
	}

	throw new ApiError('not_found', `No note has the id ${id}.`);
}

/**
 * @description Replaces the body of one of the caller's own notes. Requires `note:write`.
 * @param ctx The application context.
 * @param caller The note's author.
 * @param request The note id and its new body.
 * @returns The edited note.
 */
export async function editStaffNote(
	ctx: AppContext,
	caller: Caller,
	request: EditStaffNoteRequest,
): Promise<StaffNote> {
	requirePermission(caller, { note: ['write'] });

	const row = ctx.db
		.update(staffNote)
		.set({ body: request.body, editedAt: ctx.now() })
		.where(and(eq(staffNote.id, request.id), eq(staffNote.authorId, caller.user.id)))
		.returning()
		.get();

	if (!row) {
		return failMissingOwnNote(ctx, request.id);
	}

	return toStaffNote({ ...row, author: callerSummary(caller) }, caller);
}

/**
 * @description Deletes one of the caller's own notes. Requires `note:write`.
 * @param ctx The application context.
 * @param caller The note's author.
 * @param request The note id.
 */
export async function deleteStaffNote(
	ctx: AppContext,
	caller: Caller,
	request: DeleteStaffNoteRequest,
): Promise<void> {
	requirePermission(caller, { note: ['write'] });

	const row = ctx.db
		.delete(staffNote)
		.where(and(eq(staffNote.id, request.id), eq(staffNote.authorId, caller.user.id)))
		.returning({ id: staffNote.id })
		.get();

	if (!row) {
		await failMissingOwnNote(ctx, request.id);
	}
}

export default { queryStaffNotes, listStaffNotes, createStaffNote, editStaffNote, deleteStaffNote };
