import type { UserSummary } from '@unbound-app/contracts/account';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';
import { Type } from '@unbound-app/contracts/schema';

import { loadDashboard, loadSubmitTarget } from '~/lib/dashboard';
import type { Dashboard, SubmitTarget } from '~/lib/dashboard';
import { schemaValidator } from '~/lib/schema-validator';
import requestCaller from '~/lib/api/request-caller';
import { readUserSummary } from '~/lib/admin-users';
import { getApp } from '~/lib/app';

export type SubmitOverview = {
	githubLinked: boolean;
	/** The addon `?addon=` named, or `null` when there was none or the user cannot submit for it. */
	target: SubmitTarget | null;
};

const submitOverviewRequestSchema = Type.Object({
	addonId: Type.Optional(Type.String({ maxLength: 100 })),
});

const findUserRequestSchema = Type.Object({
	id: Type.String({ minLength: 1, maxLength: 64 }),
});

async function isGitHubLinked(headers: Headers): Promise<boolean> {
	const accounts = await getApp().auth.api.listUserAccounts({ headers });

	return accounts.some((account) => account.providerId === 'github');
}

/**
 * @description Loads what `/submit` needs for the signed-in user, and the addon it submits for when named.
 * @returns Whether the user has linked GitHub, and the addon to submit for.
 */
export const getSubmitOverview = createServerFn({ method: 'GET' })
	.validator(schemaValidator(submitOverviewRequestSchema))
	.handler(async ({ data }): Promise<SubmitOverview> => {
		const { addonId } = data;
		const [githubLinked, target] = await Promise.all([
			isGitHubLinked(getRequestHeaders()),
			addonId
				? requestCaller().then((caller) => loadSubmitTarget(getApp(), caller, addonId))
				: null,
		]);

		return { githubLinked, target };
	});

/**
 * @description Loads `/dashboard` for the signed-in user.
 * @returns The dashboard data.
 */
export const getDashboard = createServerFn({ method: 'GET' }).handler(
	async (): Promise<Dashboard> => {
		const [caller, githubLinked] = await Promise.all([
			requestCaller(),
			isGitHubLinked(getRequestHeaders()),
		]);

		return loadDashboard(getApp(), caller, githubLinked);
	},
);

/**
 * @description Looks a user up by id for the signed-in user, as the submit form's maintainers picker adds them.
 * @returns The user's name and avatar, or `null` when no user has that id.
 */
export const findUser = createServerFn({ method: 'GET' })
	.validator(schemaValidator(findUserRequestSchema))
	.handler(async ({ data }): Promise<UserSummary | null> => {
		await requestCaller();

		return (await readUserSummary(getApp(), data.id)) ?? null;
	});

export default { getSubmitOverview, getDashboard, findUser };
