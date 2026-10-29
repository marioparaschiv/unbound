import type { Subject } from '@unbound-app/contracts/admin';
import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '@tanstack/react-query';

import { createStaffNoteFn, deleteStaffNoteFn, editStaffNoteFn } from '~/lib/admin-functions';
import { subjectKey } from '~/queries/moderation-events/moderation-events';

export type EditStaffNoteVariables = {
	id: number;
	body: string;
};

// The notes and the log that records each note change both hang off the subject's page key.
async function invalidateSubject(client: QueryClient, subject: Subject) {
	await client.invalidateQueries({ queryKey: subjectKey(subject) });
}

/**
 * @description Writes a staff note on a subject, then refreshes the subject's admin page.
 * @param subject The addon or user the note is about.
 * @returns Mutation options taking the note's body.
 */
export function createStaffNoteMutation(subject: Subject) {
	return mutationOptions({
		mutationFn: (body: string) => createStaffNoteFn({ data: { subject, body } }),
		onSuccess: (_data, _body, _result, context) => invalidateSubject(context.client, subject),
	});
}

/**
 * @description Replaces the body of the caller's own note, then refreshes the subject's admin page.
 * @param subject The addon or user the note is about.
 * @returns Mutation options taking the note id and its new body.
 */
export function editStaffNoteMutation(subject: Subject) {
	return mutationOptions({
		mutationFn: (variables: EditStaffNoteVariables) => editStaffNoteFn({ data: variables }),
		onSuccess: (_data, _variables, _result, context) =>
			invalidateSubject(context.client, subject),
	});
}

/**
 * @description Deletes the caller's own note, then refreshes the subject's admin page.
 * @param subject The addon or user the note is about.
 * @returns Mutation options taking the note id.
 */
export function deleteStaffNoteMutation(subject: Subject) {
	return mutationOptions({
		mutationFn: (id: number) => deleteStaffNoteFn({ data: { id } }),
		onSuccess: (_data, _id, _result, context) => invalidateSubject(context.client, subject),
	});
}

export default { createStaffNoteMutation, editStaffNoteMutation, deleteStaffNoteMutation };
