import type { QueryClient } from '@tanstack/react-query';
import { mutationOptions } from '@tanstack/react-query';

import { adminAddonsKey } from '~/queries/admin-addons/admin-addons';
import { adminUsersKey } from '~/queries/admin-users/admin-users';
import type { AuthClientError } from '~/lib/auth/error-message';
import getAuthErrorMessage from '~/lib/auth/error-message';
import { reviewKey } from '~/queries/review/review';
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

async function invalidateUsers(client: QueryClient) {
	await client.invalidateQueries({ queryKey: adminUsersKey });
}

/**
 * @description Changes a user's role, then refreshes the admin user pages.
 * @returns Mutation options taking the user and the new role.
 */
export function setRoleMutation() {
	return mutationOptions({
		mutationFn: ({ userId, role }: SetRoleVariables) =>
			unwrap(authClient.admin.setRole({ userId, role })),
		onSuccess: (_data, _variables, _result, context) => invalidateUsers(context.client),
	});
}

/**
 * @description Bans a user, then refreshes the admin user pages, the addon pages and the review queue, which list the submissions it cancels.
 * @returns Mutation options taking the user and an optional reason.
 */
export function banUserMutation() {
	return mutationOptions({
		mutationFn: (variables: BanUserVariables) => unwrap(authClient.admin.banUser(variables)),
		onSuccess: async (_data, _variables, _result, context) => {
			await Promise.all([
				invalidateUsers(context.client),
				context.client.invalidateQueries({ queryKey: adminAddonsKey }),
				context.client.invalidateQueries({ queryKey: reviewKey }),
			]);
		},
	});
}

/**
 * @description Lifts a user's ban, then refreshes the admin user pages.
 * @returns Mutation options taking the user id.
 */
export function unbanUserMutation() {
	return mutationOptions({
		mutationFn: (userId: string) => unwrap(authClient.admin.unbanUser({ userId })),
		onSuccess: (_data, _userId, _result, context) => invalidateUsers(context.client),
	});
}

export default { setRoleMutation, banUserMutation, unbanUserMutation };
