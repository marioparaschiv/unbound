import { mutationOptions } from '@tanstack/react-query';

import type { AuthClientError } from '~/lib/auth/error-message';
import getAuthErrorMessage from '~/lib/auth/error-message';
import { invalidate } from '~/queries/invalidate';
import type { Role } from '~/lib/auth/access';
import authClient from '~/lib/auth/client';

export type SetRoleVariables = {
	userId: string;
	role: Role;
};

export type BanUserVariables = {
	userId: string;
	banReason?: string;
};

type AuthResult = {
	error: AuthClientError | null;
};

// Better Auth's client resolves with the error instead of throwing, so the mutation would count it a success.
async function unwrap(call: Promise<AuthResult>) {
	const { error } = await call;

	if (error) {
		throw new Error(getAuthErrorMessage(error));
	}
}

/**
 * @description Changes a user's role, then refreshes the admin user pages.
 * @returns Mutation options taking the user and the new role.
 */
export function setRoleMutation() {
	return mutationOptions({
		mutationFn: ({ userId, role }: SetRoleVariables) =>
			unwrap(authClient.admin.setRole({ userId, role })),
		onSuccess: (_data, _variables, _result, context) => invalidate(context.client, 'user'),
	});
}

/**
 * @description Bans a user, then refreshes the admin user pages, the addon pages and the review queue, which list the submissions it cancels.
 * @returns Mutation options taking the user and an optional reason.
 */
export function banUserMutation() {
	return mutationOptions({
		mutationFn: (variables: BanUserVariables) => unwrap(authClient.admin.banUser(variables)),
		onSuccess: (_data, _variables, _result, context) => invalidate(context.client, 'ban'),
	});
}

/**
 * @description Lifts a user's ban, then refreshes the admin user pages.
 * @returns Mutation options taking the user id.
 */
export function unbanUserMutation() {
	return mutationOptions({
		mutationFn: (userId: string) => unwrap(authClient.admin.unbanUser({ userId })),
		onSuccess: (_data, _userId, _result, context) => invalidate(context.client, 'user'),
	});
}

export default { setRoleMutation, banUserMutation, unbanUserMutation };
