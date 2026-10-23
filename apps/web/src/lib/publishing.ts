import { getRequestHeaders } from '@tanstack/react-start/server';
import { createServerFn } from '@tanstack/react-start';

import { requireCaller } from '~/lib/api/caller';
import type { Dashboard } from '~/lib/dashboard';
import { loadDashboard } from '~/lib/dashboard';
import app from '~/lib/app';

export type SubmitOverview = {
	/** Repository-backed submissions need a linked GitHub account with push access. */
	githubLinked: boolean;
};

async function isGitHubLinked(headers: Headers): Promise<boolean> {
	const accounts = await app.auth.api.listUserAccounts({ headers });

	return accounts.some((account) => account.providerId === 'github');
}

/**
 * @description Loads what `/submit` needs for the signed-in user.
 * @returns Whether the user has linked GitHub.
 */
export const getSubmitOverview = createServerFn({ method: 'GET' }).handler(
	async (): Promise<SubmitOverview> => ({
		githubLinked: await isGitHubLinked(getRequestHeaders()),
	}),
);

/**
 * @description Loads `/dashboard` for the signed-in user.
 * @returns The dashboard data.
 */
export const getDashboard = createServerFn({ method: 'GET' }).handler(
	async (): Promise<Dashboard> => {
		const headers = getRequestHeaders();
		const [caller, githubLinked] = await Promise.all([
			requireCaller(app, headers),
			isGitHubLinked(headers),
		]);

		return loadDashboard(app, caller, githubLinked);
	},
);

export default { getSubmitOverview, getDashboard };
