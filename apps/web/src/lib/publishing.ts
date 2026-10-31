import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';

import { z } from 'zod/mini';

import type { Dashboard, SubmitTarget } from '~/lib/dashboard';
import { loadDashboard, loadSubmitTarget } from '~/lib/dashboard';
import requestCaller from '~/lib/api/request-caller';
import app from '~/lib/app';

export type SubmitOverview = {
	githubLinked: boolean;
	/** The addon `?addon=` named, or `null` when there was none or the user cannot submit for it. */
	target: SubmitTarget | null;
};

const submitOverviewRequestSchema = z.object({
	addonId: z.optional(z.string().check(z.maxLength(100))),
});

async function isGitHubLinked(headers: Headers): Promise<boolean> {
	const accounts = await app.auth.api.listUserAccounts({ headers });

	return accounts.some((account) => account.providerId === 'github');
}

/**
 * @description Loads what `/submit` needs for the signed-in user, and the addon it submits for when named.
 * @returns Whether the user has linked GitHub, and the addon to submit for.
 */
export const getSubmitOverview = createServerFn({ method: 'GET' })
	.validator(submitOverviewRequestSchema)
	.handler(async ({ data }): Promise<SubmitOverview> => {
		const { addonId } = data;
		const [githubLinked, target] = await Promise.all([
			isGitHubLinked(getRequestHeaders()),
			addonId
				? requestCaller().then((caller) => loadSubmitTarget(app, caller, addonId))
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

		return loadDashboard(app, caller, githubLinked);
	},
);

export default { getSubmitOverview, getDashboard };
